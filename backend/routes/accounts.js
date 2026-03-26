const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');

router.get('/', (req, res) => {
  const db = getDb();
  const { search } = req.query;
  let query = `SELECT a.*,
    COUNT(DISTINCT c.id) as contact_count,
    COUNT(DISTINCT d.id) as deal_count,
    COALESCE(SUM(CASE WHEN d.stage NOT IN ('closed_lost') THEN d.value ELSE 0 END), 0) as pipeline_value
    FROM accounts a
    LEFT JOIN contacts c ON c.account_id = a.id
    LEFT JOIN deals d ON d.account_id = a.id
  `;
  const params = [];
  if (search) {
    query += ' WHERE a.name LIKE ? OR a.industry LIKE ?';
    const s = `%${search}%`;
    params.push(s, s);
  }
  query += ' GROUP BY a.id ORDER BY a.created_at DESC';
  res.json(db.prepare(query).all(...params));
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  if (!account) return res.status(404).json({ error: 'Account not found' });

  account.contacts = db.prepare('SELECT * FROM contacts WHERE account_id = ?').all(req.params.id);
  account.deals = db.prepare('SELECT * FROM deals WHERE account_id = ? ORDER BY created_at DESC').all(req.params.id);
  account.activities = db.prepare(`
    SELECT act.* FROM activities act
    JOIN deals d ON act.deal_id = d.id
    WHERE d.account_id = ?
    ORDER BY act.created_at DESC LIMIT 20
  `).all(req.params.id);

  res.json(account);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { name, website, industry, company_size, phone, address, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Account name required' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO accounts (id, name, website, industry, company_size, phone, address, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, website||null, industry||null, company_size||null, phone||null, address||null, notes||null);

  res.status(201).json(db.prepare('SELECT * FROM accounts WHERE id = ?').get(id));
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Account not found' });

  const { name, website, industry, company_size, phone, address, notes } = req.body;
  db.prepare(`
    UPDATE accounts SET name=?, website=?, industry=?, company_size=?, phone=?, address=?, notes=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(
    name ?? existing.name,
    website ?? existing.website,
    industry ?? existing.industry,
    company_size ?? existing.company_size,
    phone ?? existing.phone,
    address ?? existing.address,
    notes ?? existing.notes,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Account not found' });
  res.json({ success: true });
});

module.exports = router;
