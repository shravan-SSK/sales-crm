const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../lib/supabase');

router.get('/', async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    if (search) { const s = `%${search}%`; query = query.or(`first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s},company.ilike.${s}`); }
    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('leads').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Lead not found' });
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { first_name, last_name, email, phone, company, title, source, status, notes, linkedin_url } = req.body;
    if (!first_name || !last_name) return res.status(400).json({ error: 'First and last name required' });
    const { data, error } = await supabase.from('leads').insert({ id: uuidv4(), first_name, last_name, email: email||null, phone: phone||null, company: company||null, title: title||null, source: source||'manual', status: status||'new', notes: notes||null, linkedin_url: linkedin_url||null }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { data: existing, error: fe } = await supabase.from('leads').select('*').eq('id', req.params.id).single();
    if (fe || !existing) return res.status(404).json({ error: 'Lead not found' });
    const { first_name, last_name, email, phone, company, title, source, status, notes, linkedin_url } = req.body;
    const { data, error } = await supabase.from('leads').update({ first_name: first_name ?? existing.first_name, last_name: last_name ?? existing.last_name, email: email ?? existing.email, phone: phone ?? existing.phone, company: company ?? existing.company, title: title ?? existing.title, source: source ?? existing.source, status: status ?? existing.status, notes: notes ?? existing.notes, linkedin_url: linkedin_url !== undefined ? linkedin_url : existing.linkedin_url, updated_at: new Date().toISOString() }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/linkedin-data', async (req, res) => {
  try {
    const { data: lead, error: fe } = await supabase.from('leads').select('*').eq('id', req.params.id).single();
    if (fe || !lead) return res.status(404).json({ error: 'Lead not found' });
    const d = req.body;
    const profileData = { ...d, scraped_at: d.scraped_at || new Date().toISOString(), source: d.source || 'linkedin_chrome' };
    const updates = { linkedin_url: d.url || d.linkedin_url || lead.linkedin_url, linkedin_data: profileData, linkedin_scan_status: 'done', updated_at: new Date().toISOString() };
    if (!lead.title   && (d.headline || d.current_title))    updates.title   = d.headline || d.current_title;
    if (!lead.company && (d.current_company || d.company))   updates.company = d.current_company || d.company;
    const { error } = await supabase.from('leads').update(updates).eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, profile: profileData });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/scan-request', async (req, res) => {
  try {
    const { data: lead, error: fe } = await supabase.from('leads').select('*').eq('id', req.params.id).single();
    if (fe || !lead) return res.status(404).json({ error: 'Lead not found' });
    const linkedin_url = req.body.linkedin_url || lead.linkedin_url;
    if (!linkedin_url) return res.status(400).json({ error: 'No LinkedIn URL provided.' });
    const { error } = await supabase.from('leads').update({ linkedin_url, linkedin_scan_status: 'pending', updated_at: new Date().toISOString() }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'Scan queued.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/convert', async (req, res) => {
  try {
    const { data: lead, error: fe } = await supabase.from('leads').select('*').eq('id', req.params.id).single();
    if (fe || !lead) return res.status(404).json({ error: 'Lead not found' });
    let contact = null;
    if (lead.email) { const { data } = await supabase.from('contacts').select('*').eq('email', lead.email).maybeSingle(); contact = data; }
    if (!contact) {
      const { data, error } = await supabase.from('contacts').insert({ id: uuidv4(), first_name: lead.first_name, last_name: lead.last_name, email: lead.email, phone: lead.phone, title: lead.title, linkedin_url: lead.linkedin_url||null, linkedin_data: lead.linkedin_data||null, linkedin_scan_status: lead.linkedin_scan_status||'none' }).select().single();
      if (error) throw error;
      contact = data;
    }
    await supabase.from('leads').update({ status: 'converted', converted_to_contact_id: contact.id, updated_at: new Date().toISOString() }).eq('id', lead.id);
    const { data: updatedLead } = await supabase.from('leads').select('*').eq('id', lead.id).single();
    res.json({ lead: updatedLead, contact });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('leads').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
