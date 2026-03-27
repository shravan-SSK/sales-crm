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

// POST receive browser-extracted LinkedIn data (from Claude in Chrome scan or bookmarklet)
router.post('/:id/linkedin-data', (req, res) => {
  const db = getDb();
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  const data = req.body;
  const profileData = {
    ...data,
    scraped_at: data.scraped_at || new Date().toISOString(),
    source: data.source || 'linkedin_chrome',
  };

  db.prepare(`
    UPDATE contacts SET linkedin_url=?, linkedin_data=?, linkedin_scan_status='done', updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(data.url || data.linkedin_url || contact.linkedin_url, JSON.stringify(profileData), req.params.id);

  // Update title/company from LinkedIn if currently empty
  const updates = {};
  if (!contact.title && (data.headline || data.current_title)) updates.title = data.headline || data.current_title;
  if (Object.keys(updates).length > 0) {
    const sets = Object.keys(updates).map(k => `${k}=?`).join(', ');
    db.prepare(`UPDATE contacts SET ${sets}, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(...Object.values(updates), req.params.id);
  }

  res.json({ success: true, profile: profileData });
});

// POST queue contact for LinkedIn scan
router.post('/:id/scan-request', (req, res) => {
  const db = getDb();
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  const linkedin_url = req.body.linkedin_url || contact.linkedin_url;
  if (!linkedin_url) return res.status(400).json({ error: 'No LinkedIn URL provided. Add a LinkedIn URL first.' });

  db.prepare(`UPDATE contacts SET linkedin_url=?, linkedin_scan_status='pending', updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(linkedin_url, req.params.id);

  res.json({ success: true, message: 'Scan queued. Ask Claude in your Cowork chat to process pending LinkedIn scans.' });
});

// DELETE contact
router.delete('/:id', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Contact not found' });
  res.json({ success: true });
});

module.exports = router;
