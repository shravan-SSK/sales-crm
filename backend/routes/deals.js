const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../lib/supabase');

router.get('/', async (req, res) => {
  try {
    const { stage } = req.query;
    let query = supabase.from('deals').select('*, accounts(name), contacts(first_name,last_name)').order('created_at', { ascending: false });
    if (stage) query = query.eq('stage', stage);
    const { data, error } = await query;
    if (error) throw error;
    res.json((data || []).map(d => ({ ...d, account_name: d.accounts?.name||null, contact_name: d.contacts ? `${d.contacts.first_name} ${d.contacts.last_name}` : null, accounts: undefined, contacts: undefined })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { data: deal, error } = await supabase.from('deals').select('*, accounts(name), contacts(first_name,last_name,email)').eq('id', req.params.id).single();
    if (error || !deal) return res.status(404).json({ error: 'Deal not found' });
    const [activitiesR, stakeholdersR] = await Promise.all([
      supabase.from('activities').select('*').eq('deal_id', req.params.id).order('created_at', { ascending: false }),
      supabase.from('deal_stakeholders').select('*, contacts(id,first_name,last_name,email,title)').eq('deal_id', req.params.id),
    ]);
    res.json({ ...deal, account_name: deal.accounts?.name||null, accounts: undefined, contacts: undefined, activities: activitiesR.data||[], stakeholders: (stakeholdersR.data||[]).map(s => ({ ...s, ...s.contacts, contacts: undefined })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, account_id, contact_id, stage, value, probability, close_date, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Deal name required' });
    const { data, error } = await supabase.from('deals').insert({ id: uuidv4(), name, account_id: account_id||null, contact_id: contact_id||null, stage: stage||'lead', value: value||0, probability: probability||0, close_date: close_date||null, notes: notes||null }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { data: existing, error: fe } = await supabase.from('deals').select('*').eq('id', req.params.id).single();
    if (fe || !existing) return res.status(404).json({ error: 'Deal not found' });
    const { name, account_id, contact_id, stage, value, probability, close_date, notes } = req.body;
    const { data, error } = await supabase.from('deals').update({ name: name ?? existing.name, account_id: account_id !== undefined ? account_id : existing.account_id, contact_id: contact_id !== undefined ? contact_id : existing.contact_id, stage: stage ?? existing.stage, value: value !== undefined ? value : existing.value, probability: probability !== undefined ? probability : existing.probability, close_date: close_date !== undefined ? close_date : existing.close_date, notes: notes ?? existing.notes, updated_at: new Date().toISOString() }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('deals').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/stakeholders', async (req, res) => {
  try {
    const { contact_id, role } = req.body;
    if (!contact_id) return res.status(400).json({ error: 'contact_id required' });
    const { data, error } = await supabase.from('deal_stakeholders').insert({ id: uuidv4(), deal_id: req.params.id, contact_id, role: role||null }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id/stakeholders/:stakeholderId', async (req, res) => {
  try {
    const { error } = await supabase.from('deal_stakeholders').delete().eq('id', req.params.stakeholderId);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
