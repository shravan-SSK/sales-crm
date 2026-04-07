const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../lib/supabase');

// GET /stats/overview — source performance stats (MUST be before /:id)
router.get('/stats/overview', async (req, res) => {
  try {
    const [sourcesR, leadsR] = await Promise.all([
      supabase.from('sources').select('id, name, color').order('name'),
      supabase.from('leads').select('source, status'),
    ]);
    if (sourcesR.error) throw sourcesR.error;
    if (leadsR.error) throw leadsR.error;
    const leads = leadsR.data || [];
    const stats = (sourcesR.data || []).map(s => {
      const sourceLeads = leads.filter(l => l.source === s.name);
      return {
        ...s,
        total_leads: sourceLeads.length,
        converted: sourceLeads.filter(l => l.status === 'Converted').length,
      };
    });
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase.from('sources').select('*').order('name');
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /
router.post('/', async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const { data, error } = await supabase.from('sources').insert({
      id: uuidv4(), name, color: color || '#6366f1', is_active: 1,
    }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /:id
router.put('/:id', async (req, res) => {
  try {
    const { name, color, is_active } = req.body;
    const { data, error } = await supabase.from('sources').update({
      ...(name !== undefined && { name }),
      ...(color !== undefined && { color }),
      ...(is_active !== undefined && { is_active }),
      updated_at: new Date().toISOString(),
    }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('sources').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
