const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');

router.get('/', async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const [leadsR, contactsR] = await Promise.all([
      supabase.from('leads').select('id,first_name,last_name,company,title,linkedin_url,linkedin_scan_status,updated_at')
        .eq('linkedin_scan_status', status).not('linkedin_url', 'is', null),
      supabase.from('contacts').select('id,first_name,last_name,title,linkedin_url,linkedin_scan_status,updated_at')
        .eq('linkedin_scan_status', status).not('linkedin_url', 'is', null),
    ]);
    const leads    = (leadsR.data    || []).map(r => ({ ...r, type: 'lead',    name: `${r.first_name} ${r.last_name}`.trim(), save_url: `/api/leads/${r.id}/linkedin-data` }));
    const contacts = (contactsR.data || []).map(r => ({ ...r, type: 'contact', name: `${r.first_name} ${r.last_name}`.trim(), save_url: `/api/contacts/${r.id}/linkedin-data` }));
    const queue = [...leads, ...contacts].sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at));
    res.json({ count: queue.length, items: queue });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:type/:id/fail', async (req, res) => {
  try {
    const { type, id } = req.params;
    if (!['lead', 'contact'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
    const table = type === 'lead' ? 'leads' : 'contacts';
    const { error } = await supabase.from(table).update({
      linkedin_scan_status: 'failed', updated_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
