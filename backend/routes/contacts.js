const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const axios = require('axios');
const cheerio = require('cheerio');

// GET all contacts
router.get('/', (req, res) => {
  const db = getDb();
  const { search, account_id } = req.query;
  let query = `SELECT c.*, a.name as account_name
               FROM contacts c
               LEFT JOIN accounts a ON c.account_id = a.id`;
  const params = [];

  if (account_id) {
    query += ' WHERE c.account_id = ?';
    params.push(account_id);
  }
  if (search) {
    const clause = account_id ? ' AND' : ' WHERE';
    query += `${clause} (c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ? OR a.name LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  query += ' ORDER BY c.created_at DESC';

  res.json(db.prepare(query).all(...params));
});

// GET single contact with related data
router.get('/:id', (req, res) => {
  const db = getDb();
  const contact = db.prepare(`
    SELECT c.*, a.name as account_name
    FROM contacts c LEFT JOIN accounts a ON c.account_id = a.id
    WHERE c.id = ?
  `).get(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  if (contact.linkedin_data) {
    try { contact.linkedin_data = JSON.parse(contact.linkedin_data); } catch(e) {}
  }

  contact.deals = db.prepare(`
    SELECT d.*, a.name as account_name FROM deals d
    LEFT JOIN accounts a ON d.account_id = a.id
    WHERE d.contact_id = ? OR d.id IN (
      SELECT deal_id FROM deal_stakeholders WHERE contact_id = ?
    )
  `).all(req.params.id, req.params.id);

  contact.activities = db.prepare(`
    SELECT * FROM activities WHERE contact_id = ? ORDER BY created_at DESC LIMIT 10
  `).all(req.params.id);

  contact.emails = db.prepare(`
    SELECT * FROM email_threads WHERE contact_id = ? ORDER BY received_at DESC LIMIT 10
  `).all(req.params.id);

  res.json(contact);
});

// POST create contact
router.post('/', (req, res) => {
  const db = getDb();
  const { first_name, last_name, email, phone, title, account_id, linkedin_url, notes } = req.body;
  if (!first_name || !last_name) return res.status(400).json({ error: 'First and last name required' });

  if (email) {
    const existing = db.prepare('SELECT id FROM contacts WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ error: 'Contact with this email already exists', id: existing.id });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO contacts (id, first_name, last_name, email, phone, title, account_id, linkedin_url, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, first_name, last_name, email||null, phone||null, title||null, account_id||null, linkedin_url||null, notes||null);

  res.status(201).json(db.prepare('SELECT * FROM contacts WHERE id = ?').get(id));
});

// PUT update contact
router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Contact not found' });

  const { first_name, last_name, email, phone, title, account_id, linkedin_url, notes } = req.body;

  db.prepare(`
    UPDATE contacts SET first_name=?, last_name=?, email=?, phone=?, title=?, account_id=?, linkedin_url=?, notes=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(
    first_name ?? existing.first_name,
    last_name ?? existing.last_name,
    email ?? existing.email,
    phone ?? existing.phone,
    title ?? existing.title,
    account_id !== undefined ? account_id : existing.account_id,
    linkedin_url ?? existing.linkedin_url,
    notes ?? existing.notes,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id));
});

// POST scan LinkedIn profile
router.post('/:id/linkedin-scan', async (req, res) => {
  const db = getDb();
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  const linkedinUrl = req.body.linkedin_url || contact.linkedin_url;
  if (!linkedinUrl) return res.status(400).json({ error: 'No LinkedIn URL provided' });

  try {
    const profileData = await scrapeLinkedInProfile(linkedinUrl);

    db.prepare(`
      UPDATE contacts SET linkedin_url=?, linkedin_data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
    `).run(linkedinUrl, JSON.stringify(profileData), req.params.id);

    res.json({ success: true, profile: profileData });
  } catch (err) {
    res.status(500).json({ error: 'Failed to scan LinkedIn profile', details: err.message });
  }
});

async function scrapeLinkedInProfile(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
    const profile = {};

    // Open Graph meta tags (often available on public profiles)
    profile.name = $('meta[property="og:title"]').attr('content') || '';
    profile.description = $('meta[property="og:description"]').attr('content') || '';
    profile.image = $('meta[property="og:image"]').attr('content') || '';
    profile.url = url;

    // Try to parse name into first/last
    if (profile.name) {
      const parts = profile.name.split(' ');
      profile.first_name = parts[0] || '';
      profile.last_name = parts.slice(1).join(' ') || '';
    }

    // Parse description for headline/company info
    if (profile.description) {
      const descParts = profile.description.split(' at ');
      if (descParts.length >= 2) {
        profile.headline = descParts[0].trim();
        profile.company = descParts[1].split('.')[0].trim();
      } else {
        profile.headline = profile.description.split('.')[0].trim();
      }
    }

    profile.scraped_at = new Date().toISOString();
    profile.source = 'linkedin_public';

    return profile;
  } catch (err) {
    // Return partial data even on failure
    return {
      url,
      error: err.message,
      scraped_at: new Date().toISOString(),
      note: 'LinkedIn may require authentication for full profile data. Consider using a service like Proxycurl for complete enrichment.'
    };
  }
}

// DELETE contact
router.delete('/:id', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Contact not found' });
  res.json({ success: true });
});

module.exports = router;
