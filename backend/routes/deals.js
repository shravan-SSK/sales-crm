const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');

const STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
const STAGE_PROBABILITIES = { lead: 10, qualified: 25, proposal: 50, negotiation: 75, closed_won: 100, closed_lost: 0 };

// GET all deals with pipeline grouping
router.get('/', (req, res) => {
  const db = getDb();
  const { stage, account_id, contact_id } = req.query;

  let query = `SELECT d.*,
    a.name as account_name,
    c.first_name || ' ' || c.last_name as contact_name,
    c.email as contact_email
    FROM deals d
    LEFT JOIN accounts a ON d.account_id = a.id
    LEFT JOIN contacts c ON d.contact_id = c.id
  `;
  const params = [];
  const wheres = [];
  if (stage) { wheres.push('d.stage = ?'); params.push(stage); }
  if (account_id) { wheres.push('d.account_id = ?'); params.push(account_id); }
  if (contact_id) { wheres.push('d.contact_id = ?'); params.push(contact_id); }
  if (wheres.length) query += ' WHERE ' + wheres.join(' AND ');
  query += ' ORDER BY d.updated_at DESC';

  const deals = db.prepare(query).all(...params);

  // Attach stakeholders
  for (const deal of deals) {
    deal.stakeholders = db.prepare(`
      SELECT ds.*, c.first_name, c.last_name, c.email, c.title
      FROM deal_stakeholders ds JOIN contacts c ON ds.contact_id = c.id
      WHERE ds.deal_id = ?
    `).all(deal.id);
  }

  res.json(deals);
});

// GET pipeline summary
router.get('/pipeline', (req, res) => {
  const db = getDb();
  const pipeline = {};
  for (const stage of STAGES) {
    const deals = db.prepare(`
      SELECT d.*, a.name as account_name, c.first_name || ' ' || c.last_name as contact_name
      FROM deals d
      LEFT JOIN accounts a ON d.account_id = a.id
      LEFT JOIN contacts c ON d.contact_id = c.id
      WHERE d.stage = ?
      ORDER BY d.updated_at DESC
    `).all(stage);
    pipeline[stage] = deals;
  }
  res.json(pipeline);
});

// GET revenue forecast
router.get('/forecast', (req, res) => {
  const db = getDb();
  const months = parseInt(req.query.months) || 6;
  const forecast = [];

  for (let i = 0; i < months; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() + i);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;

    const deals = db.prepare(`
      SELECT value, probability, stage FROM deals
      WHERE strftime('%Y-%m', close_date) = ?
      AND stage NOT IN ('closed_lost')
    `).all(monthStr);

    const weighted = deals.reduce((sum, d) => sum + (d.value * d.probability / 100), 0);
    const committed = deals.filter(d => d.stage === 'closed_won').reduce((sum, d) => sum + d.value, 0);
    const pipeline = deals.filter(d => d.stage !== 'closed_won').reduce((sum, d) => sum + d.value, 0);

    forecast.push({
      month: monthStr,
      label: date.toLocaleString('default', { month: 'short', year: 'numeric' }),
      weighted,
      committed,
      pipeline,
      deal_count: deals.length
    });
  }

  res.json(forecast);
});

// GET single deal
router.get('/:id', (req, res) => {
  const db = getDb();
  const deal = db.prepare(`
    SELECT d.*, a.name as account_name, c.first_name || ' ' || c.last_name as contact_name
    FROM deals d
    LEFT JOIN accounts a ON d.account_id = a.id
    LEFT JOIN contacts c ON d.contact_id = c.id
    WHERE d.id = ?
  `).get(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  deal.stakeholders = db.prepare(`
    SELECT ds.*, c.first_name, c.last_name, c.email, c.title, c.linkedin_url
    FROM deal_stakeholders ds JOIN contacts c ON ds.contact_id = c.id
    WHERE ds.deal_id = ?
  `).all(req.params.id);

  deal.activities = db.prepare(`
    SELECT * FROM activities WHERE deal_id = ? ORDER BY created_at DESC
  `).all(req.params.id);

  deal.emails = db.prepare(`
    SELECT * FROM email_threads WHERE deal_id = ? ORDER BY received_at DESC
  `).all(req.params.id);

  res.json(deal);
});

// POST create deal
router.post('/', (req, res) => {
  const db = getDb();
  const { name, account_id, contact_id, stage, value, probability, close_date, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Deal name required' });

  const id = uuidv4();
  const stageVal = STAGES.includes(stage) ? stage : 'lead';
  const probVal = probability !== undefined ? probability : STAGE_PROBABILITIES[stageVal];

  db.prepare(`
    INSERT INTO deals (id, name, account_id, contact_id, stage, value, probability, close_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, account_id||null, contact_id||null, stageVal, value||0, probVal, close_date||null, notes||null);

  res.status(201).json(db.prepare('SELECT * FROM deals WHERE id = ?').get(id));
});

// PUT update deal (including stage changes)
router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Deal not found' });

  const { name, account_id, contact_id, stage, value, probability, close_date, notes } = req.body;
  const newStage = stage && STAGES.includes(stage) ? stage : existing.stage;
  const newProb = probability !== undefined ? probability : (stage ? STAGE_PROBABILITIES[newStage] : existing.probability);

  db.prepare(`
    UPDATE deals SET name=?, account_id=?, contact_id=?, stage=?, value=?, probability=?, close_date=?, notes=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(
    name ?? existing.name,
    account_id !== undefined ? account_id : existing.account_id,
    contact_id !== undefined ? contact_id : existing.contact_id,
    newStage,
    value ?? existing.value,
    newProb,
    close_date !== undefined ? close_date : existing.close_date,
    notes ?? existing.notes,
    req.params.id
  );

  // Auto-log stage change activity
  if (stage && stage !== existing.stage) {
    const actId = uuidv4();
    db.prepare(`
      INSERT INTO activities (id, type, subject, description, deal_id, completed)
      VALUES (?, 'stage_change', ?, ?, ?, 1)
    `).run(actId, `Stage changed to ${newStage}`, `Deal moved from ${existing.stage} to ${newStage}`, req.params.id);
  }

  res.json(db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id));
});

// POST add stakeholder
router.post('/:id/stakeholders', (req, res) => {
  const db = getDb();
  const { contact_id, role } = req.body;
  if (!contact_id) return res.status(400).json({ error: 'contact_id required' });

  const existing = db.prepare('SELECT id FROM deal_stakeholders WHERE deal_id = ? AND contact_id = ?').get(req.params.id, contact_id);
  if (existing) return res.status(409).json({ error: 'Stakeholder already added' });

  const id = uuidv4();
  db.prepare('INSERT INTO deal_stakeholders (id, deal_id, contact_id, role) VALUES (?, ?, ?, ?)').run(id, req.params.id, contact_id, role||null);
  res.status(201).json({ id, deal_id: req.params.id, contact_id, role });
});

// DELETE stakeholder
router.delete('/:id/stakeholders/:contact_id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM deal_stakeholders WHERE deal_id = ? AND contact_id = ?').run(req.params.id, req.params.contact_id);
  res.json({ success: true });
});

// DELETE deal
router.delete('/:id', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM deals WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Deal not found' });
  res.json({ success: true });
});

module.exports = router;
