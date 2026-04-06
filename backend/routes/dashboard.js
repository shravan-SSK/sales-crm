const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');

router.get('/stats', async (req, res) => {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const today   = new Date().toISOString().split('T')[0];
    const [leadsR,contactsR,accountsR,openDealsR,pipelineR,wonR,overdueR,newLeadsR,stageR,recentR,topDealsR] = await Promise.all([
      supabase.from('leads').select('id',{count:'exact',head:true}).neq('status','converted'),
      supabase.from('contacts').select('id',{count:'exact',head:true}),
      supabase.from('accounts').select('id',{count:'exact',head:true}),
      supabase.from('deals').select('id',{count:'exact',head:true}).not('stage','in','("closed_won","closed_lost")'),
      supabase.from('deals').select('value').not('stage','in','("closed_won","closed_lost")'),
      supabase.from('deals').select('value').eq('stage','closed_won'),
      supabase.from('activities').select('id',{count:'exact',head:true}).eq('completed',0).lt('due_date',today),
      supabase.from('leads').select('id',{count:'exact',head:true}).gte('created_at',weekAgo),
      supabase.from('deals').select('stage,value'),
      supabase.from('activities').select('*,deals(name),contacts(first_name,last_name)').order('created_at',{ascending:false}).limit(5),
      supabase.from('deals').select('*,accounts(name)').not('stage','in','("closed_won","closed_lost")').order('value',{ascending:false}).limit(5),
    ]);
    const pipelineValue=(pipelineR.data||[]).reduce((s,d)=>s+(Number(d.value)||0),0);
    const wonValue=(wonR.data||[]).reduce((s,d)=>s+(Number(d.value)||0),0);
    const stageMap={};
    (stageR.data||[]).forEach(d=>{if(!stageMap[d.stage])stageMap[d.stage]={stage:d.stage,count:0,value:0};stageMap[d.stage].count++;stageMap[d.stage].value+=Number(d.value)||0;});
    res.json({
      totalLeads:leadsR.count||0,totalContacts:contactsR.count||0,totalAccounts:accountsR.count||0,
      openDeals:openDealsR.count||0,pipelineValue,wonValue,
      overdueActivities:overdueR.count||0,newLeadsThisWeek:newLeadsR.count||0,
      stageBreakdown:Object.values(stageMap),
      recentActivity:(recentR.data||[]).map(a=>({...a,deal_name:a.deals?.name||null,contact_name:a.contacts?`${a.contacts.first_name} ${a.contacts.last_name}`:null,deals:undefined,contacts:undefined})),
      topDeals:(topDealsR.data||[]).map(d=>({...d,account_name:d.accounts?.name||null,accounts:undefined})),
    });
  } catch(e){res.status(500).json({error:e.message});}
});

module.exports = router;
