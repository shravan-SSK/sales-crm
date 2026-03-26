const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');

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

  const leads = db.prepare(query).all(...params);
  res.json(leads);
});

// GET single lead
router.get('/:id', (req, res) => {
  const db = getDb();
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  res.json(lead);
});

// POST create lead
router.post('/', (req, res) => {
  const db = getDb();
  const { first_name, last_name, email, phone, company, title, source, status, notes } = req.body;
  if (!first_name || !last_name) return res.status(400).json({ error: 'First and last name required' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO leads (id, first_name, last_name, email, phone, company, title, source, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, first_name, last_name, email || null, phone || null, company || null, title || null, source || 'manual', status || 'new', notes || null);

  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  res.status(201).json(lead);
});

// PUT update lead
router.put('/:id', (req, res) => {
  const db = getDb();
  const { first_name, last_name, email, phone, company, title, source, status, notes } = req.body;
  const existing = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Lead not found' });

  db.prepare(`
    UPDATE leads SET first_name=?, last_name=?, email=?, phone=?, company=?, title=?, source=?, status=?, notes=?, updated_at=CURRENT_TIMESTAMP
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
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id));
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
      INSERT INTO contacts (id, first_name, last_name, email, phone, title)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(contactId, lead.first_name, lead.last_name, lead.email, lead.phone, lead.title);
    contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(contactId);
  }

  db.prepare('UPDATE leads SET status=?, converted_to_contact_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run('converted', contact.id, lead.id);

  res.json({ lead: db.prepare('SELECT * FROM leads WHERE id = ?').get(lead.id), contact });
});

// DELETE lead
router.delete('/:id', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Lead not found' });
  res.json({ success: true });
});

module.exports = router;
