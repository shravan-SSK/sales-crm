const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

// GET all pending or recent LinkedIn scans (for Claude to process)
router.get('/', (req, res) => {
  const db = getDb();
  const status = req.query.status || 'pending';

  const leads = db.prepare(
    `SELECT id, 'lead' as type, first_name, last_name, company, title, linkedin_url, linkedin_scan_status, updated_at
     FROM leads WHERE linkedin_scan_status = ? AND linkedin_url IS NOT NULL ORDER BY updated_at DESC`
  ).all(status);

  const contacts = db.prepare(
    `SELECT id, 'contact' as type, first_name, last_name, title, linkedin_url, linkedin_scan_status, updated_at
     FROM contacts WHERE linkedin_scan_status = ? AND linkedin_url IS NOT NULL ORDER BY updated_at DESC`
  ).all(status);

  const queue = [...leads, ...contacts].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  res.json({
    count: queue.length,
    items: queue.map(item => ({
      ...item,
      name: `${item.first_name} ${item.last_name}`.trim(),
      save_url: item.type === 'lead'
        ? `/api/leads/${item.id}/linkedin-data`
        : `/api/contacts/${item.id}/linkedin-data`,
    }))
  });
});

// POST mark a scan as failed
router.post('/:type/:id/fail', (req, res) => {
  const db = getDb();
  const { type, id } = req.params;
  const table = type === 'lead' ? 'leads' : 'contacts';
  db.prepare(`UPDATE ${table} SET linkedin_scan_status='failed', updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(id);
  res.json({ success: true });
});

module.exports = router;
