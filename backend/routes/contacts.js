const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../lib/supabase');

// GET all contacts
router.get('/', async (req, res) => {
  try {
    const { search, account_id } = req.query;
    let query = supabase.from('contacts').select('*, accounts(name)').order('created_at', { ascending: false });
    if (account_id) query = query.eq('account_id', account_id);
    if (search) {
      const s = '%' + search + '%';
      query = query.or('first_name.ilike.' + s + ',last_name.ilike.' + s + ',email.ilike.' + s);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json((data || []).map(c => ({ ...c, account_name: c.accounts?.name || null, accounts: undefined })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET contacts with pending LinkedIn scans
router.get('/pending-linkedin-scans', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, linkedin_url, linkedin_data')
      .eq('linkedin_scan_status', 'pending')
      .not('linkedin_url', 'is', null);
    if (error) throw error;
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET single contact with related data
router.get('/:id', async (req, res) => {
  try {
    const { data: contact, error } = await supabase
      .from('contacts').select('*, accounts(name)').eq('id', req.params.id).single();
    if (error || !contact) return res.status(404).json({ error: 'Contact not found' });
    const result = { ...contact, account_name: contact.accounts?.name || null, accounts: undefined };

    const [dealsR, activitiesR, emailsR, stakeholderDealsR] = await Promise.all([
      supabase.from('deals').select('*, accounts(name)').eq('contact_id', req.params.id),
      supabase.from('activities').select('*').eq('contact_id', req.params.id)
        .order('created_at', { ascending: false }).limit(20),
      supabase.from('email_threads').select('*').eq('contact_id', req.params.id)
        .order('received_at', { ascending: false }).limit(10),
      supabase.from('deal_stakeholders').select('*, deals(id,name,stage,value,accounts(name))').eq('contact_id', req.params.id),
    ]);

    result.deals = (dealsR.data || []).map(d => ({ ...d, account_name: d.accounts?.name || null, accounts: undefined }));
    result.activities = activitiesR.data || [];
    result.emails = emailsR.data || [];
    result.stakeholder_deals = (stakeholderDealsR.data || []).map(s => ({
      id: s.deals?.id, name: s.deals?.name, stage: s.deals?.stage,
      value: s.deals?.value, account_name: s.deals?.accounts?.name || null, role: s.role,
    })).filter(d => d.id);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create contact
router.post('/', async (req, res) => {
  try {
    const { first_name, last_name, email, phone, title, account_id, linkedin_url, notes } = req.body;
    if (!first_name || !last_name) return res.status(400).json({ error: 'First and last name required' });
    if (email) {
      const { data: existing } = await supabase.from('contacts').select('id').eq('email', email).maybeSingle();
      if (existing) return res.status(409).json({ error: 'Contact with this email already exists', id: existing.id });
    }
    const { data, error } = await supabase.from('contacts').insert({
      id: uuidv4(), first_name, last_name,
      email: email || null, phone: phone || null, title: title || null,
      account_id: account_id || null, linkedin_url: linkedin_url || null, notes: notes || null,
    }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT update contact
router.put('/:id', async (req, res) => {
  try {
    const { data: existing, error: fe } = await supabase.from('contacts').select('*').eq('id', req.params.id).single();
    if (fe || !existing) return res.status(404).json({ error: 'Contact not found' });
    const { first_name, last_name, email, phone, title, account_id, linkedin_url, notes } = req.body;
    const { data, error } = await supabase.from('contacts').update({
      first_name:  first_name  ?? existing.first_name,
      last_name:   last_name   ?? existing.last_name,
      email:       email       ?? existing.email,
      phone:       phone       ?? existing.phone,
      title:       title       ?? existing.title,
      account_id:  account_id  !== undefined ? account_id  : existing.account_id,
      linkedin_url: linkedin_url !== undefined ? linkedin_url : existing.linkedin_url,
      notes:       notes       ?? existing.notes,
      updated_at:  new Date().toISOString(),
    }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST receive LinkedIn data (with job-change delta detection)
router.post('/:id/linkedin-data', async (req, res) => {
  try {
    const { data: contact, error: fe } = await supabase.from('contacts').select('*').eq('id', req.params.id).single();
    if (fe || !contact) return res.status(404).json({ error: 'Contact not found' });
    const d = req.body;
    const profileData = { ...d, scraped_at: d.scraped_at || new Date().toISOString(), source: d.source || 'linkedin_chrome' };

    // Delta detection: log activity if current company changed
    const oldCompany = contact.linkedin_data?.experience?.[0]?.company || contact.linkedin_data?.current_company;
    const newCompany = d.experience?.[0]?.company || d.current_company;
    let jobChanged = false;
    if (oldCompany && newCompany && oldCompany.trim() !== newCompany.trim()) {
      jobChanged = true;
      await supabase.from('activities').insert({
        id: uuidv4(),
        contact_id: req.params.id,
        type: 'note',
        subject: 'Job change detected: moved from ' + oldCompany + ' to ' + newCompany,
        description: 'LinkedIn scan detected that ' + contact.first_name + ' ' + contact.last_name + ' changed companies from "' + oldCompany + '" to "' + newCompany + '"',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    const updates = {
      linkedin_url: d.url || d.linkedin_url || contact.linkedin_url,
      linkedin_data: profileData,
      linkedin_scan_status: 'done',
      updated_at: new Date().toISOString(),
    };
    if (!contact.title && (d.headline || d.current_title)) updates.title = d.headline || d.current_title;
    const { error } = await supabase.from('contacts').update(updates).eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, profile: profileData, job_change: jobChanged });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST queue LinkedIn scan
router.post('/:id/scan-request', async (req, res) => {
  try {
    const { data: contact, error: fe } = await supabase.from('contacts').select('*').eq('id', req.params.id).single();
    if (fe || !contact) return res.status(404).json({ error: 'Contact not found' });
    const linkedin_url = req.body.linkedin_url || contact.linkedin_url;
    if (!linkedin_url) return res.status(400).json({ error: 'No LinkedIn URL provided. Add one first.' });
    const { error } = await supabase.from('contacts').update({
      linkedin_url, linkedin_scan_status: 'pending', updated_at: new Date().toISOString(),
    }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true, message: 'Scan queued.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE contact
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('contacts').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
