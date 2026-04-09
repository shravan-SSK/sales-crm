const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../lib/supabase');

async function addTimeline(deal_id, event_type, title, description, metadata) {
  try {
    await supabase.from('deal_timeline').insert({
      id: uuidv4(), deal_id, event_type, title,
      description: description || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
      created_at: new Date().toISOString()
    })
  } catch (e) { console.error('Timeline error:', e.message) }
}

// GET /pipeline â deals grouped by stage (MUST be before /:id)
router.get('/pipeline', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('deals')
      .select('*, accounts(name), contacts(first_name,last_name)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const pipeline = {};
    (data || []).forEach(d => {
      const stage = d.stage || 'lead';
      if (!pipeline[stage]) pipeline[stage] = [];
      pipeline[stage].push({
        ...d,
        account_name: d.accounts?.name || null,
        contact_name: d.contacts ? `${d.contacts.first_name} ${d.contacts.last_name}` : null,
        accounts: undefined,
        contacts: undefined,
      });
    });
    res.json(pipeline);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /forecast â monthly revenue forecast (MUST be before /:id)
router.get('/forecast', async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 6;
    const { data, error } = await supabase
      .from('deals')
      .select('value,probability,close_date,stage')
      .neq('stage', 'closed_lost')
      .not('close_date', 'is', null);
    if (error) throw error;
    const result = [];
    const now = new Date();
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      const month = d.toISOString().slice(0, 7);
      const monthDeals = (data || []).filter(deal => deal.close_date && deal.close_date.startsWith(month));
      const pipeline = monthDeals.reduce((sum, d) => sum + (d.value || 0), 0);
      const weighted = monthDeals.reduce((sum, d) => sum + (d.value || 0) * ((d.probability || 0) / 100), 0);
      const committed = monthDeals.filter(d => d.stage === 'closed_won').reduce((sum, d) => sum + (d.value || 0), 0);
      result.push({ month, label, deal_count: monthDeals.length, pipeline, weighted, committed });
    }
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /
router.get('/', async (req, res) => {
  try {
    const { stage } = req.query;
    let query = supabase.from('deals').select('*, accounts(name), contacts(first_name,last_name)').order('created_at', { ascending: false });
    if (stage) query = query.eq('stage', stage);
    const { data, error } = await query;
    if (error) throw error;
    res.json((data || []).map(d => ({
      ...d,
      account_name: d.accounts?.name || null,
      contact_name: d.contacts ? `${d.contacts.first_name} ${d.contacts.last_name}` : null,
      accounts: undefined,
      contacts: undefined
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const { data: deal, error } = await supabase
      .from('deals')
      .select('*, accounts(name), contacts(first_name,last_name,email)')
      .eq('id', req.params.id).single();
    if (error || !deal) return res.status(404).json({ error: 'Deal not found' });
    const [activitiesR, stakeholdersR] = await Promise.all([
      supabase.from('activities').select('*').eq('deal_id', req.params.id).order('created_at', { ascending: false }),
      supabase.from('deal_stakeholders').select('*, contacts(id,first_name,last_name,email,title)').eq('deal_id', req.params.id),
    ]);
    res.json({
      ...deal,
      account_name: deal.accounts?.name || null,
      contact_name: deal.contacts ? `${deal.contacts.first_name} ${deal.contacts.last_name}` : null,
      activities: activitiesR.data || [],
      stakeholders: (stakeholdersR.data || []).map(s => ({ ...s, ...s.contacts, contacts: undefined }))
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST / â create deal with optional auto-create account + contact
router.post('/', async (req, res) => {
  try {
    const {
      name, account_id, contact_id, stage, value, probability, close_date, notes, source,
      new_account_name, new_contact_first_name, new_contact_last_name, new_contact_email
    } = req.body;
    if (!name) return res.status(400).json({ error: 'Deal name required' });

    let finalAccountId = account_id || null;
    let finalContactId = contact_id || null;
    let autoCreated = {};

    // Auto-create account if new name provided and no existing account selected
    if (!finalAccountId && new_account_name?.trim()) {
      const { data: acct, error: acctErr } = await supabase.from('accounts').insert({
        id: uuidv4(), name: new_account_name.trim(), created_at: new Date().toISOString(), updated_at: new Date().toISOString()
      }).select().single();
      if (acctErr) throw acctErr;
      finalAccountId = acct.id;
      autoCreated.account = acct;
    }

    // Auto-create contact if new name provided and no existing contact selected
    if (!finalContactId && new_contact_first_name?.trim()) {
      const contactData = {
        id: uuidv4(),
        first_name: new_contact_first_name.trim(),
        last_name: (new_contact_last_name || '').trim(),
        account_id: finalAccountId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      if (new_contact_email?.trim()) contactData.email = new_contact_email.trim();
      const { data: ct, error: ctErr } = await supabase.from('contacts').insert(contactData).select().single();
      if (ctErr) {
        // If duplicate email, find existing contact
        if (ctErr.message?.includes('unique') || ctErr.message?.includes('duplicate')) {
          if (new_contact_email?.trim()) {
            const { data: existing } = await supabase.from('contacts').select('id').eq('email', new_contact_email.trim()).single();
            if (existing) finalContactId = existing.id;
          }
        } else {
          throw ctErr;
        }
      } else if (ct) {
        finalContactId = ct.id;
        autoCreated.contact = ct;
      }
    }

    const dealId = uuidv4();
    const dealStage = stage || 'lead';
    const { data, error } = await supabase.from('deals').insert({
      id: dealId, name, account_id: finalAccountId, contact_id: finalContactId,
      stage: dealStage, value: value || 0, probability: probability || 0,
      close_date: close_date || null, notes: notes || null, source: source || null
    }).select().single();
    if (error) throw error;

    // Add deal_created timeline event
    await addTimeline(dealId, 'deal_created', `Deal created: ${name}`,
      `Stage: ${dealStage}${value ? ` | Value: $${Number(value).toLocaleString()}` : ''}`,
      { stage: dealStage, value: value || 0 });

    res.status(201).json({ ...data, auto_created: autoCreated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /:id
router.put('/:id', async (req, res) => {
  try {
    const { data: existing, error: fe } = await supabase.from('deals').select('*').eq('id', req.params.id).single();
    if (fe || !existing) return res.status(404).json({ error: 'Deal not found' });

    const { name, account_id, contact_id, stage, value, probability, close_date, notes } = req.body;
    const oldStage = existing.stage;
    const newStage = stage ?? existing.stage;

    const { data, error } = await supabase.from('deals').update({
      name: name ?? existing.name,
      account_id: account_id !== undefined ? account_id : existing.account_id,
      contact_id: contact_id !== undefined ? contact_id : existing.contact_id,
      stage: newStage,
      value: value !== undefined ? value : existing.value,
      probability: probability !== undefined ? probability : existing.probability,
      close_date: close_date !== undefined ? close_date : existing.close_date,
      notes: notes ?? existing.notes,
      updated_at: new Date().toISOString()
    }).eq('id', req.params.id).select().single();
    if (error) throw error;

    // Record stage change in timeline
    if (stage && stage !== oldStage) {
      await addTimeline(req.params.id, 'stage_change',
        `Stage moved: ${oldStage} â ${stage}`,
        null,
        { old_stage: oldStage, new_stage: stage });
    }

    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('deals').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /:id/stakeholders
router.post('/:id/stakeholders', async (req, res) => {
  try {
    const { contact_id, role } = req.body;
    if (!contact_id) return res.status(400).json({ error: 'contact_id required' });
    const { data, error } = await supabase.from('deal_stakeholders').insert({
      id: uuidv4(), deal_id: req.params.id, contact_id, role: role || null
    }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /:id/stakeholders/:stakeholderId
router.delete('/:id/stakeholders/:stakeholderId', async (req, res) => {
  try {
    const { error } = await supabase.from('deal_stakeholders').delete().eq('id', req.params.stakeholderId);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
