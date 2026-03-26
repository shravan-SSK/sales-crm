const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');

router.get('/', (req, res) => {
  const db = getDb();
  const { deal_id, contact_id, type, overdue, upcoming } = req.query;

  let query = `SELECT a.*,
    d.name as deal_name,
    c.first_name || ' ' || c.last_name as contact_name
    FROM activities a
    LEFT JOIN deals d ON a.deal_id = d.id
    LEFT JOIN contacts c ON a.contact_id = c.id
  `;
  const params = [];
  const wheres = [];

  if (deal_id) { wheres.push('a.deal_id = ?'); params.push(deal_id); }
  if (contact_id) { wheres.push('a.contact_id = ?'); params.push(contact_id); }
  if (type) { wheres.push('a.type = ?'); params.push(type); }
  if (overdue === 'true') {
    wheres.push("a.completed = 0 AND a.due_date < date('now')");
  }
  if (upcoming === 'true') {
    wheres.push("a.completed = 0 AND a.due_date >= date('now') AND a.due_date <= date('now', '+7 days')");
  }

  if (wheres.length) query += ' WHERE ' + wheres.join(' AND ');
  query += ' ORDER BY a.due_date ASC, a.created_at DESC';

  res.json(db.prepare(query).all(...params));
});

router.get('/reminders', (req, res) => {
  const db = getDb();
  const overdue = db.prepare(`
    SELECT a.*, d.name as deal_name, c.first_name || ' ' || c.last_name as contact_name
    FROM activities a
    LEFT JOIN deals d ON a.deal_id = d.id
    LEFT JOIN contacts c ON a.contact_id = c.id
    WHERE a.completed = 0 AND a.due_date < date('now')
    ORDER BY a.due_date ASC
  `).all();

  const upcoming = db.prepare(`
    SELECT a.*, d.name as deal_name, c.first_name || ' ' || c.last_name as contact_name
    FROM activities a
    LEFT JOIN deals d ON a.deal_id = d.id
    LEFT JOIN contacts c ON a.contact_id = c.id
    WHERE a.completed = 0 AND a.due_date >= date('now') AND a.due_date <= date('now', '+7 days')
    ORDER BY a.due_date ASC
  `).all();

  // Stale deals (no activity in 14+ days)
  const staleDeals = db.prepare(`
    SELECT d.id, d.name, d.stage, a.name as account_name,
    MAX(act.created_at) as last_activity,
    julianday('now') - julianday(MAX(act.created_at)) as days_since_activity
    FROM deals d
    LEFT JOIN accounts a ON d.account_id = a.id
    LEFT JOIN activities act ON act.deal_id = d.id
    WHERE d.stage NOT IN ('closed_won', 'closed_lost')
    GROUP BY d.id
    HAVING last_activity IS NULL OR days_since_activity > 14
    ORDER BY days_since_activity DESC
  `).all();

  res.json({ overdue, upcoming, staleDeals });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
  if (!activity) return res.status(404).json({ error: 'Activity not found' });
  res.json(activity);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { type, subject, description, deal_id, contact_id, lead_id, due_date, completed } = req.body;
  if (!type || !subject) return res.status(400).json({ error: 'Type and subject required' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO activities (id, type, subject, description, deal_id, contact_id, lead_id, due_date, completed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, type, subject, description||null, deal_id||null, contact_id||null, lead_id||null, due_date||null, completed ? 1 : 0);

  res.status(201).json(db.prepare('SELECT * FROM activities WHERE id = ?').get(id));
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Activity not found' });

  const { type, subject, description, deal_id, contact_id, due_date, completed } = req.body;
  const isCompleting = completed && !existing.completed;

  db.prepare(`
    UPDATE activities SET type=?, subject=?, description=?, deal_id=?, contact_id=?, due_date=?, completed=?, completed_at=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(
    type ?? existing.type,
    subject ?? existing.subject,
    description ?? existing.description,
    deal_id !== undefined ? deal_id : existing.deal_id,
    contact_id !== undefined ? contact_id : existing.contact_id,
    due_date !== undefined ? due_date : existing.due_date,
    completed !== undefined ? (completed ? 1 : 0) : existing.completed,
    isCompleting ? new Date().toISOString() : existing.completed_at,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM activities WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Activity not found' });
  res.json({ success: true });
});

module.exports = router;
