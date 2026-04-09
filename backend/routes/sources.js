const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../lib/supabase');

// GET /stats/overview - source performance stats from deals (MUST be before /:id)
router.get('/stats/overview', async (req, res) => {
  try {
    const [sourcesR, dealsR] = await Promise.all([
      supabase.from('sources').select('id, name, color, is_active').order('name'),
      supabase.from('deals').select('source, stage, value'),
    ]);
    if (sourcesR.error) throw sourcesR.error;
    if (dealsR.error) throw dealsR.error;
    const deals = dealsR.data || [];
    const allDeals = dealsR.data || [];
    const stats = (sourcesR.data || []).map(s => {
      const srcDeals = allDeals.filter(d => d.source === s.name);
      const total_leads = srcDeals.length;
      const stage_lead = srcDeals.filter(d => d.stage === 'lead').length;
      const stage_qualified = srcDeals.filter(d => d.stage === 'qualified').length;
      const stage_proposal = srcDeals.filter(d => d.stage === 'proposal').length;
      const stage_negotiation = srcDeals.filter(d => d.stage === 'negotiation').length;
      const stage_closed_won = srcDeals.filter(d => d.stage === 'closed_won').length;
      const converted_value = srcDeals.filter(d => d.stage === 'closed_won').reduce((sum, d) => sum + parseFloat(d.value || 0), 0);
      const total_value = srcDeals.reduce((sum, d) => sum + parseFloat(d.value || 0), 0);
      return {
        ...s,
        stats: { total_leads, stage_lead, stage_qualified, stage_proposal, stage_negotiation, stage_closed_won, converted_value, total_value },
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
