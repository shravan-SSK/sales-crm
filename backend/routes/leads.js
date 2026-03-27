const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');

// Helper: parse linkedin_data from JSON string if stored
function parseLead(lead) {
  if (!lead) return lead;
  if (lead.linkedin_data && typeof lead.linkedin_data === 'string') {
    try { lead.linkedin_data = JSON.parse(lead.linkedin_data); } catch(e) {}
  }
  return lead;
}

// GET all leads
router.get('/', (req, res) => {
  const db = getDb();
  const { status, search } = req.query;
  let query = `SELECT l.*, c.id as contact_id_ref
               FROM leads l
               LEFT JOIN contacts c ON l.email = c.email`;
  const params = [];

  if (status) {
    query += ' WHERE l.status = ?';
    params.push(status);
  }
  if (search) {
    const clause = status ? ' AND' : ' WHERE';
    query += `${clause} (l.first_name LIKE ? OR l.last_name LIKE ? OR l.email LIKE ? OR l.company LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  query += ' ORDER BY l.created_at DESC';

  const leads = db.prepare(query).all(...params).map(parseLead);
  res.json(leads);
});

// GET single lead
router.get('/:id', (req, res) => {
  const db = getDb();
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  res.json(parseLead(lead));
});

// POST create lead
router.post('/', (req, res) => {
  const db = getDb();
  const { first_name, last_name, email, phone, company, title, source, status, notes, linkedin_url } = req.body;
  if (!first_name || !last_name) return res.status(400).json({ error: 'First and last name required' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO leads (id, first_name, last_name, email, phone, company, title, source, status, notes, linkedin_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, first_name, last_name, email || null, phone || null, company || null, title || null,
         source || 'manual', status || 'new', notes || null, linkedin_url || null);

  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  res.status(201).json(parseLead(lead));
});

// PUT update lead
router.put('/:id', (req, res) => {
  const db = getDb();
  const { first_name, last_name, email, phone, company, title, source, status, notes, linkedin_url } = req.body;
  const existing = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Lead not found' });

  db.prepare(`
    UPDATE leads SET first_name=?, last_name=?, email=?, phone=?, company=?, title=?, source=?, status=?, notes=?, linkedin_url=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(
    first_name ?? existing.first_name,
    last_name ?? existing.last_name,
    email ?? existing.email,
    phone ?? existing.phone,
    company ?? existing.company,
    title ?? existing.title,
    source ?? existing.source,
    status ?? existing.status,
    notes ?? existing.notes,
    linkedin_url !== undefined ? linkedin_url : existing.linkedin_url,
    req.params.id
  );

  res.json(parseLead(db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id)));
});

// POST receive browser-extracted LinkedIn data (from Claude in Chrome scan)
router.post('/:id/linkedin-data', (req, res) => {
  const db = getDb();
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  const data = req.body;
  const profileData = {
    ...data,
    scraped_at: data.scraped_at || new Date().toISOString(),
    source: data.source || 'linkedin_chrome',
  };

  db.prepare(`
    UPDATE leads SET linkedin_url=?, linkedin_data=?, linkedin_scan_status='done', updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(data.url || data.linkedin_url || lead.linkedin_url, JSON.stringify(profileData), req.params.id);

  // Update title/company from LinkedIn if currently empty
  const updates = {};
  if (!lead.title && (data.headline || data.current_title)) updates.title = data.headline || data.current_title;
  if (!lead.company && (data.current_company || data.company)) updates.company = data.current_company || data.company;
  if (Object.keys(updates).length > 0) {
    const sets = Object.keys(updates).map(k => `${k}=?`).join(', ');
    db.prepare(`UPDATE leads SET ${sets}, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(...Object.values(updates), req.params.id);
  }

  res.json({ success: true, profile: profileData });
});

// POST queue lead for LinkedIn scan
router.post('/:id/scan-request', (req, res) => {
  const db = getDb();
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  const linkedin_url = req.body.linkedin_url || lead.linkedin_url;
  if (!linkedin_url) return res.status(400).json({ error: 'No LinkedIn URL provided. Add a LinkedIn URL first.' });

  db.prepare(`UPDATE leads SET linkedin_url=?, linkedin_scan_status='pending', updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(linkedin_url, req.params.id);

  res.json({ success: true, message: 'Scan queued. Ask Claude in your Cowork chat to process pending LinkedIn scans.' });
});

// POST convert lead to contact
router.post('/:id/convert', (req, res) => {
  const db = getDb();
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  // Check if contact with this email already exists
  let contact = lead.email ? db.prepare('SELECT * FROM contacts WHERE email = ?').get(lead.email) : null;

  if (!contact) {
    const contactId = uuidv4();
    db.prepare(`
      INSERT INTO contacts (id, first_name, last_name, email, phone, title, linkedin_url, linkedin_data, linkedin_scan_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(contactId, lead.first_name, lead.last_name, lead.email, lead.phone, lead.title,
           lead.linkedin_url || null, lead.linkedin_data || null, lead.linkedin_scan_status || 'none');
    contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(contactId);
  }

  db.prepare('UPDATE leads SET status=?, converted_to_contact_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run('converted', contact.id, lead.id);

  res.json({ lead: parseLead(db.prepare('SELECT * FROM leads WHERE id = ?').get(lead.id)), contact });
});

// DELETE lead
router.delete('/:id', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Lead not found' });
  res.json({ success: true });
});

module.exports = router;
