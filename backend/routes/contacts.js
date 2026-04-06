const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../lib/supabase');

router.get('/', async (req, res) => {
  try {
    const { search, account_id } = req.query;
    let query = supabase.from('contacts').select('*, accounts(name)').order('created_at', { ascending: false });
    if (account_id) query = query.eq('account_id', account_id);
    if (search) { const s = `%${search}%`; query = query.or(`first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s}`); }
    const { data, error } = await query;
    if (error) throw error;
    res.json((data || []).map(c => ({ ...c, account_name: c.accounts?.name || null, accounts: undefined })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { data: contact, error } = await supabase.from('contacts').select('*, accounts(name)').eq('id', req.params.id).single();
    if (error || !contact) return res.status(404).json({ error: 'Contact not found' });
    const result = { ...contact, account_name: contact.accounts?.name || null, accounts: undefined };
    const [dealsR, activitiesR, emailsR] = await Promise.all([
      supabase.from('deals').select('*, accounts(name)').eq('contact_id', req.params.id),
      supabase.from('activities').select('*').eq('contact_id', req.params.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('email_threads').select('*').eq('contact_id', req.params.id).order('received_at', { ascending: false }).limit(10),
    ]);
    result.deals = (dealsR.data || []).map(d => ({ ...d, account_name: d.accounts?.name || null, accounts: undefined }));
    result.activities = activitiesR.data || [];
    result.emails = emailsR.data || [];
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { first_name, last_name, email, phone, title, account_id, linkedin_url, notes } = req.body;
    if (!first_name || !last_name) return res.status(400).json({ error: 'First and last name required' });
    if (email) { const { data: ex } = await supabase.from('contacts').select('id').eq('email', email).maybeSingle(); if (ex) return res.status(409).json({ error: 'Contact with this email already exists', id: ex.id }); }
    const { data, error } = await supabase.from('contacts').insert({ id: uuidv4(), first_name, last_name, email: email||null, phone: phone||null, title: title||null, account_id: account_id||null, linkedin_url: linkedin_url||null, notes: notes||null }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { data: existing, error: fe } = await supabase.from('contacts').select('*').eq('id', req.params.id).single();
    if (fe || !existing) return res.status(404).json({ error: 'Contact not found' });
    const { first_name, last_name, email, phone, title, account_id, linkedin_url, notes } = req.body;
    const { data, error } = await supabase.from('contacts').update({ first_name: first_name ?? existing.first_name, last_name: last_name ?? existing.last_name, email: email ?? existing.email, phone: phone ?? existing.phone, title: title ?? existing.title, account_id: account_id !== undefined ? account_id : existing.account_id, linkedin_url: linkedin_url !== undefined ? linkedin_url : existing.linkedin_url, notes: notes ?? existing.notes, updated_at: new Date().toISOString() }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/linkedin-data', async (req, res) => {
  try {
    const { data: contact, error: fe } = await supabase.from('contacts').select('*').eq('id', req.params.id).single();
    if (fe || !contact) return res.status(404).json({ error: 'Contact not found' });
    const d = req.body;
    const profileData = { ...d, scraped_at: d.scraped_at || new Date().toISOString(), source: d.source || 'linkedin_chrome' };
    const updates = { linkedin_url: d.url || d.linkedin_url || contact.linkedin_url, linkedin_data: profileData, linkedin_scan_status: 'done', updated_at: new Date().toISOString() };
    if (!contact.title && (d.headline || d.current_title)) updates.title = d.headline || d.current_title;
    const { error } = await supabase.from('contacts').update(updates).eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, profile: profileData });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/scan-request', async (req, res) => {
  try {
    const { data: contact, error: fe } = await supabase.from('contacts').select('*').eq('id', req.params.id).single();
    if (fe || !contact) return res.status(404).json({ error: 'Contact not found' });
    const linkedin_url = req.body.linkedin_url || contact.linkedin_url;
    if (!linkedin_url) return res.status(400).json({ error: 'No LinkedIn URL provided.' });
    const { error } = await supabase.from('contacts').update({ linkedin_url, linkedin_scan_status: 'pending', updated_at: new Date().toISOString() }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'Scan queued.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('contacts').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
