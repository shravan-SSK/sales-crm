const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

router.get('/stats', (req, res) => {
  const db = getDb();

  const totalLeads = db.prepare("SELECT COUNT(*) as count FROM leads WHERE status != 'converted'").get().count;
  const totalContacts = db.prepare('SELECT COUNT(*) as count FROM contacts').get().count;
  const totalAccounts = db.prepare('SELECT COUNT(*) as count FROM accounts').get().count;
  const openDeals = db.prepare("SELECT COUNT(*) as count FROM deals WHERE stage NOT IN ('closed_won','closed_lost')").get().count;
  const pipelineValue = db.prepare("SELECT COALESCE(SUM(value), 0) as total FROM deals WHERE stage NOT IN ('closed_won','closed_lost')").get().total;
  const wonValue = db.prepare("SELECT COALESCE(SUM(value), 0) as total FROM deals WHERE stage = 'closed_won'").get().total;
  const overdueActivities = db.prepare("SELECT COUNT(*) as count FROM activities WHERE completed = 0 AND due_date < date('now')").get().count;
  const newLeadsThisWeek = db.prepare("SELECT COUNT(*) as count FROM leads WHERE created_at >= date('now', '-7 days')").get().count;

  const stageBreakdown = db.prepare(`
    SELECT stage, COUNT(*) as count, COALESCE(SUM(value), 0) as value
    FROM deals GROUP BY stage
  `).all();

  const recentActivity = db.prepare(`
    SELECT a.*, d.name as deal_name, c.first_name || ' ' || c.last_name as contact_name
    FROM activities a
    LEFT JOIN deals d ON a.deal_id = d.id
    LEFT JOIN contacts c ON a.contact_id = c.id
    ORDER BY a.created_at DESC LIMIT 5
  `).all();

  const topDeals = db.prepare(`
    SELECT d.*, a.name as account_name
    FROM deals d LEFT JOIN accounts a ON d.account_id = a.id
    WHERE d.stage NOT IN ('closed_won','closed_lost')
    ORDER BY d.value DESC LIMIT 5
  `).all();

  res.json({
    totalLeads,
    totalContacts,
    totalAccounts,
    openDeals,
    pipelineValue,
    wonValue,
    overdueActivities,
    newLeadsThisWeek,
    stageBreakdown,
    recentActivity,
    topDeals,
  });
});

module.exports = router;
