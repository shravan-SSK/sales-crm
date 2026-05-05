require('dotenv').config();
const express = require('express');
const cors = require('cors');
const supabase = require('./lib/supabase');
const app = express();

// ── CORS ───────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
  'https://sales-crm-kohl.vercel.app',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS: ' + origin + ' not allowed'));
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── API KEY AUTH ───────────────────────────────────────────────────────────
// All /api/* routes require X-API-Key header matching the env var API_SECRET_KEY.
// Health check is exempt so uptime monitors still work.
const API_SECRET_KEY = process.env.API_SECRET_KEY;

app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next(); // exempt health check
  if (!API_SECRET_KEY) return next();        // skip if key not configured (dev mode)
  const key = req.headers['x-api-key'];
  if (!key || key !== API_SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// ── ROUTES ──────────────────────────────────────────────────────────────────
app.use('/api/leads',        require('./routes/leads'));
app.use('/api/contacts',     require('./routes/contacts'));
app.use('/api/accounts',     require('./routes/accounts'));
app.use('/api/deals',        require('./routes/deals'));
app.use('/api/deals/:id',    require('./routes/deal-details'));
app.use('/api/activities',   require('./routes/activities'));
app.use('/api/gmail',        require('./routes/gmail'));
app.use('/api/dashboard',    require('./routes/dashboard'));
app.use('/api/sources',      require('./routes/sources'));
app.use('/api/scan-queue',   require('./routes/scan-queue'));
app.use('/api/bulk-import',  require('./routes/bulk-import'));

// Settings
app.get('/api/settings', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('key, value')
      .not('key', 'in', '("gmail_tokens","gmail_client_secret")');
    if (error) throw error;
    const result = {};
    (data || []).forEach(s => { result[s.key] = s.value; });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/settings', async (req, res) => {
  try {
    const sensitive = ['gmail_tokens', 'gmail_client_secret'];
    for (const [key, value] of Object.entries(req.body)) {
      if (sensitive.includes(key)) continue;
      await supabase.from('settings').upsert(
        { key, value: String(value), updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Global search
app.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ leads: [], contacts: [], accounts: [], deals: [] });
    const s = '%' + q + '%';
    const [leadsR, contactsR, accountsR, dealsR] = await Promise.all([
      supabase.from('leads').select('id,first_name,last_name,email,company,status')
        .or('first_name.ilike.' + s + ',last_name.ilike.' + s + ',email.ilike.' + s + ',company.ilike.' + s).limit(5),
      supabase.from('contacts').select('id,first_name,last_name,email,title')
        .or('first_name.ilike.' + s + ',last_name.ilike.' + s + ',email.ilike.' + s).limit(5),
      supabase.from('accounts').select('id,name,industry')
        .or('name.ilike.' + s + ',industry.ilike.' + s).limit(5),
      supabase.from('deals').select('id,name,stage,value').ilike('name', s).limit(5),
    ]);
    res.json({
      leads: leadsR.data || [], contacts: contactsR.data || [],
      accounts: accountsR.data || [], deals: dealsR.data || [],
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Health check (no auth required)
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log('CRM API at http://localhost:' + PORT));
}
module.exports = app;
