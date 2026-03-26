require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const { getDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware — allow both local dev and the deployed Render frontend URL
const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (e.g. curl, mobile apps)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/leads', require('./routes/leads'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/deals', require('./routes/deals'));
app.use('/api/activities', require('./routes/activities'));
app.use('/api/gmail', require('./routes/gmail'));
app.use('/api/dashboard', require('./routes/dashboard'));

// Settings
app.get('/api/settings', (req, res) => {
  const db = getDb();
  const settings = db.prepare("SELECT key, value FROM settings WHERE key NOT IN ('gmail_tokens', 'gmail_client_secret')").all();
  const result = {};
  settings.forEach(s => result[s.key] = s.value);
  res.json(result);
});

app.put('/api/settings', (req, res) => {
  const db = getDb();
  const upsert = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP");
  for (const [key, value] of Object.entries(req.body)) {
    if (!['gmail_tokens', 'gmail_client_secret'].includes(key)) {
      upsert.run(key, String(value));
    }
  }
  res.json({ success: true });
});

// Search across all entities
app.get('/api/search', (req, res) => {
  const db = getDb();
  const { q } = req.query;
  if (!q || q.length < 2) return res.json({ leads: [], contacts: [], accounts: [], deals: [] });

  const s = `%${q}%`;
  const leads = db.prepare("SELECT id, first_name, last_name, email, company, status FROM leads WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR company LIKE ? LIMIT 5").all(s, s, s, s);
  const contacts = db.prepare("SELECT id, first_name, last_name, email, title FROM contacts WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ? LIMIT 5").all(s, s, s);
  const accounts = db.prepare("SELECT id, name, industry FROM accounts WHERE name LIKE ? OR industry LIKE ? LIMIT 5").all(s, s);
  const deals = db.prepare("SELECT id, name, stage, value FROM deals WHERE name LIKE ? LIMIT 5").all(s);

  res.json({ leads, contacts, accounts, deals });
});

// Scheduled: Daily reminder check (runs at 9am)
cron.schedule('0 9 * * *', () => {
  console.log('[CRON] Checking overdue activities...');
  const db = getDb();
  const overdue = db.prepare("SELECT COUNT(*) as count FROM activities WHERE completed=0 AND due_date < date('now')").get().count;
  if (overdue > 0) console.log(`[CRON] ${overdue} overdue activities found`);
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`\n🚀 Sales CRM API running at http://localhost:${PORT}`);
  console.log(`   Database: ${path.join(__dirname, 'crm.db')}`);
  console.log(`   API docs: http://localhost:${PORT}/api/health\n`);

  // Initialize DB on startup
  getDb();
});

module.exports = app;
