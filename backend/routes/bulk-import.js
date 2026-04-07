const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../lib/supabase');

// Generic helper
async function bulkInsert(res, records, mapFn, table) {
  if (!Array.isArray(records) || records.length === 0)
    return res.status(400).json({ error: 'records array required' });
  let imported = 0;
  const errors = [];
  for (const row of records) {
    try {
      const mapped = mapFn(row);
      if (!mapped) { errors.push('Row skipped: validation failed'); continue; }
      const { error } = await supabase.from(table).insert(mapped);
      if (error) throw error;
      imported++;
    } catch (e) { errors.push(e.message); }
  }
  res.json({ imported, total: records.length, errors });
}

// POST /api/bulk-import/contacts
router.post('/contacts', async (req, res) => {
  try {
    await bulkInsert(res, req.body.records, (row) => {
      const fn = (row.first_name || row.firstname || '').trim();
      const ln = (row.last_name  || row.lastname  || '').trim();
      if (!fn || !ln) return null;
      return {
        id: uuidv4(),
        first_name: fn, last_name: ln,
        email: row.email || null,
        phone: row.phone || null,
        title: row.title || null,
        account_id: row.account_id || null,
        linkedin_url: row.linkedin_url || null,
        notes: row.notes || null,
      };
    }, 'contacts');
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/bulk-import/accounts
router.post('/accounts', async (req, res) => {
  try {
    await bulkInsert(res, req.body.records, (row) => {
      const name = (row.name || row.company || '').trim();
      if (!name) return null;
      return {
        id: uuidv4(),
        name,
        industry:  row.industry  || null,
        website:   row.website   || null,
        phone:     row.phone     || null,
        address:   row.address   || null,
        notes:     row.notes     || null,
      };
    }, 'accounts');
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/bulk-import/sources
router.post('/sources', async (req, res) => {
  try {
    await bulkInsert(res, req.body.records, (row) => {
      const name = (row.name || '').trim();
      if (!name) return null;
      return {
        id: uuidv4(),
        name,
        color:     row.color     || '#6b7280',
        is_active: row.is_active !== undefined ? (row.is_active === 'true' || row.is_active === true || row.is_active === '1') : true,
        notes:     row.notes     || null,
      };
    }, 'sources');
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/bulk-import/pipeline  (deals)
router.post('/pipeline', async (req, res) => {
  try {
    await bulkInsert(res, req.body.records, (row) => {
      const name = (row.name || row.deal_name || row.title || '').trim();
      if (!name) return null;
      return {
        id: uuidv4(),
        name,
        stage:       row.stage       || 'prospecting',
        value:       row.value ? parseFloat(row.value) : null,
        probability: row.probability ? parseInt(row.probability, 10) : null,
        close_date:  row.close_date  || null,
        notes:       row.notes       || null,
        contact_id:  row.contact_id  || null,
        account_id:  row.account_id  || null,
      };
    }, 'deals');
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
