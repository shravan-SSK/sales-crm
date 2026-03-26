const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');

// GET all sources
router.get('/', (req, res) => {
  const db = getDb();
  const sources = db.prepare('SELECT * FROM sources ORDER BY name ASC').all();
  res.json(sources);
});

// GET source stats overview
router.get('/stats/overview', (req, res) => {
  const db = getDb();
  const sources = db.prepare('SELECT * FROM sources ORDER BY name ASC').all();

  const stats = sources.map(source => {
    const total = db.prepare("SELECT COUNT(*) as n FROM leads WHERE source = ?").get(source.name).n;
    const converted = db.prepare("SELECT COUNT(*) as n FROM leads WHERE source = ? AND status = 'converted'").get(source.name).n;
    const qualified = db.prepare("SELECT COUNT(*) as n FROM leads WHERE source = ? AND status = 'qualified'").get(source.name).n;
    const new_leads = db.prepare("SELECT COUNT(*) as n FROM leads WHERE source = ? AND status = 'new'").get(source.name).n;
    const contacted = db.prepare("SELECT COUNT(*) as n FROM leads WHERE source = ? AND status = 'contacted'").get(source.name).n;
    const conversion_rate = total > 0 ? Math.round((converted / total) * 100) : 0;
    return { ...source, stats: { total_leads: total, converted, qualified, new_leads, contacted, conversion_rate } };
  });

  res.json(stats);
});

// GET single source
router.get('/:id', (req, res) => {
  const db = getDb();
  const source = db.prepare('SELECT * FROM sources WHERE id = ?').get(req.params.id);
  if (!source) return res.status(404).json({ error: 'Source not found' });
  res.json(source);
});

// POST create source
router.post('/', (req, res) => {
  const db = getDb();
  const { name, color = '#6366f1', is_active = 1 } = req.body;
  if (!name) return res.status(400).json({ error: 'Source name is required' });

  const existing = db.prepare('SELECT id FROM sources WHERE name = ?').get(name);
  if (existing) return res.status(409).json({ error: 'A source with this name already exists' });

  const id = uuidv4();
  db.prepare('INSERT INTO sources (id, name, color, is_active) VALUES (?, ?, ?, ?)').run(id, name.trim(), color, is_active ? 1 : 0);
  res.status(201).json(db.prepare('SELECT * FROM sources WHERE id = ?').get(id));
});

// PUT update source
router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM sources WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Source not found' });

  const { name, color, is_active } = req.body;

  if (name && name !== existing.name) {
    const dupe = db.prepare('SELECT id FROM sources WHERE name = ? AND id != ?').get(name, req.params.id);
    if (dupe) return res.status(409).json({ error: 'A source with this name already exists' });
  }

  db.prepare(`UPDATE sources SET name=?, color=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(
    name ?? existing.name,
    color ?? existing.color,
    is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM sources WHERE id = ?').get(req.params.id));
});

// DELETE source
router.delete('/:id', (req, res) => {
  const db = getDb();
  const source = db.prepare('SELECT * FROM sources WHERE id = ?').get(req.params.id);
  if (!source) return res.status(404).json({ error: 'Source not found' });

  const leadCount = db.prepare('SELECT COUNT(*) as n FROM leads WHERE source = ?').get(source.name).n;
  if (leadCount > 0) {
    return res.status(400).json({
      error: `Cannot delete: ${leadCount} lead(s) use this source. Deactivate it instead.`,
      lead_count: leadCount,
    });
  }

  db.prepare('DELETE FROM sources WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
