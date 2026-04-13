const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../lib/supabase');

// GET reminders — returns { overdue: [...], staleDeals: [...] }
router.get('/reminders', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('activities')
      .select('*, deals(name), contacts(first_name,last_name), leads(first_name,last_name)')
      .eq('completed', 0)
      .not('due_date', 'is', null)
      .order('due_date', { ascending: true })
      .limit(50);
    if (error) throw error;

    const mapped = (data || []).map(a => ({
      ...a,
      deal_name: a.deals?.name || null,
      contact_name: a.contacts ? `${a.contacts.first_name} ${a.contacts.last_name}` : null,
      lead_name: a.leads ? `${a.leads.first_name} ${a.leads.last_name}` : null,
      deals: undefined, contacts: undefined, leads: undefined,
    }));

    const overdue = mapped.filter(a => a.due_date < today);

    // Stale deals: active deals with no activity in 14+ days
    const { data: activeDeals } = await supabase
      .from('deals')
      .select('id, name')
      .not('stage', 'in', '("closed_won","closed_lost")');

    const staleDeals = [];
    for (const deal of (activeDeals || [])) {
      const { data: lastAct } = await supabase
        .from('activities')
        .select('created_at')
        .eq('deal_id', deal.id)
        .order('created_at', { ascending: false })
        .limit(1);
      const lastDate = lastAct?.[0]?.created_at;
      const daysSince = lastDate
        ? (Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24)
        : 999;
      if (daysSince >= 14) staleDeals.push({ ...deal, days_since_activity: daysSince });
    }

    res.json({ overdue, staleDeals });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/', async (req, res) => {
  try {
    const { deal_id, contact_id, lead_id, completed, account_id, type, overdue, upcoming } = req.query;

    // account_id filter: resolve to deal IDs first
    if (account_id) {
      const { data: acctDeals, error: de } = await supabase
        .from('deals').select('id').eq('account_id', account_id);
      if (de) throw de;
      const dealIds = (acctDeals || []).map(d => d.id);
      if (dealIds.length === 0) return res.json([]);
      const { data, error } = await supabase
        .from('activities')
        .select('*, deals(name), contacts(first_name,last_name), leads(first_name,last_name)')
        .in('deal_id', dealIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return res.json((data || []).map(a => ({
        ...a,
        deal_name: a.deals?.name || null,
        contact_name: a.contacts ? `${a.contacts.first_name} ${a.contacts.last_name}` : null,
        lead_name: a.leads ? `${a.leads.first_name} ${a.leads.last_name}` : null,
        deals: undefined, contacts: undefined, leads: undefined,
      })));
    }

    let query = supabase
      .from('activities')
      .select('*, deals(name), contacts(first_name,last_name), leads(first_name,last_name)')
      .order('due_date', { ascending: true });

    if (deal_id) query = query.eq('deal_id', deal_id);
    if (contact_id) query = query.eq('contact_id', contact_id);
    if (lead_id) query = query.eq('lead_id', lead_id);
    if (type) query = query.eq('type', type);
    if (completed !== undefined) query = query.eq('completed', completed === 'true' ? 1 : 0);

    if (overdue === 'true') {
      const today = new Date().toISOString().split('T')[0];
      query = query.eq('completed', 0).lt('due_date', today).not('due_date', 'is', null);
    }
    if (upcoming === 'true') {
      const today = new Date().toISOString().split('T')[0];
      const nw = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      query = query.eq('completed', 0).gte('due_date', today).lte('due_date', nw);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json((data || []).map(a => ({
      ...a,
      deal_name: a.deals?.name || null,
      contact_name: a.contacts ? `${a.contacts.first_name} ${a.contacts.last_name}` : null,
      lead_name: a.leads ? `${a.leads.first_name} ${a.leads.last_name}` : null,
      deals: undefined, contacts: undefined, leads: undefined,
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { type, subject, description, deal_id, contact_id, lead_id, due_date } = req.body;
    if (!type || !subject) return res.status(400).json({ error: 'type and subject required' });
    const { data, error } = await supabase.from('activities').insert({
      id: uuidv4(), type, subject,
      description: description || null,
      deal_id: deal_id || null,
      contact_id: contact_id || null,
      lead_id: lead_id || null,
      due_date: due_date || null,
      completed: 0,
    }).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { data: existing, error: fe } = await supabase.from('activities').select('*').eq('id', req.params.id).single();
    if (fe || !existing) return res.status(404).json({ error: 'Activity not found' });
    const { type, subject, description, deal_id, contact_id, lead_id, due_date, completed } = req.body;
    const updates = {
      type: type ?? existing.type,
      subject: subject ?? existing.subject,
      description: description ?? existing.description,
      deal_id: deal_id !== undefined ? deal_id : existing.deal_id,
      contact_id: contact_id !== undefined ? contact_id : existing.contact_id,
      lead_id: lead_id !== undefined ? lead_id : existing.lead_id,
      due_date: due_date !== undefined ? due_date : existing.due_date,
      updated_at: new Date().toISOString(),
    };
    if (completed !== undefined) {
      updates.completed = completed ? 1 : 0;
      updates.completed_at = completed ? new Date().toISOString() : null;
    }
    const { data, error } = await supabase.from('activities').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('activities').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
