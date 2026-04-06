const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../lib/supabase');

router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = supabase.from('accounts').select('*').order('created_at', { ascending: false });
    if (search) { const s = `%${search}%`; query = query.or(`name.ilike.${s},industry.ilike.${s}`); }
    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { data: account, error } = await supabase.from('accounts').select('*').eq('id', req.params.id).single();
    if (error || !account) return res.status(404).json({ error: 'Account not found' });
    const [contactsR, dealsR] = await Promise.all([
      supabase.from('contacts').select('id,first_name,last_name,email,title').eq('account_id', req.params.id),
      supabase.from('deals').select('*').eq('account_id', req.params.id).order('created_at', { ascending: false }),
    ]);
    res.json({ ...account, contacts: contactsR.data || [], deals: dealsR.data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, website, industry, company_size, phone, address, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Account name required' });
    const { data, error } = await supabase.from('accounts').insert({ id: uuidv4(), name, website: website||null, industry: industry||null, company_size: company_size||null, phone: phone||null, address: address||null, notes: notes||null }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { data: existing, error: fe } = await supabase.from('accounts').select('*').eq('id', req.params.id).single();
    if (fe || !existing) return res.status(404).json({ error: 'Account not found' });
    const { name, website, industry, company_size, phone, address, notes } = req.body;
    const { data, error } = await supabase.from('accounts').update({ name: name ?? existing.name, website: website ?? existing.website, industry: industry ?? existing.industry, company_size: company_size ?? existing.company_size, phone: phone ?? existing.phone, address: address ?? existing.address, notes: notes ?? existing.notes, updated_at: new Date().toISOString() }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('accounts').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
