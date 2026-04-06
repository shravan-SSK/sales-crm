require('dotenv').config();
const express = require('express');
const cors = require('cors');
const supabase = require('./lib/supabase');

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/leads',      require('./routes/leads'));
app.use('/api/contacts',   require('./routes/contacts'));
app.use('/api/accounts',   require('./routes/accounts'));
app.use('/api/deals',      require('./routes/deals'));
app.use('/api/activities', require('./routes/activities'));
app.use('/api/gmail',      require('./routes/gmail'));
app.use('/api/dashboard',  require('./routes/dashboard'));
app.use('/api/sources',    require('./routes/sources'));
app.use('/api/scan-queue', require('./routes/scan-queue'));

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
    const s = `%${q}%`;
    const [leadsR, contactsR, accountsR, dealsR] = await Promise.all([
      supabase.from('leads').select('id,first_name,last_name,email,company,status')
        .or(`first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s},company.ilike.${s}`).limit(5),
      supabase.from('contacts').select('id,first_name,last_name,email,title')
        .or(`first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s}`).limit(5),
      supabase.from('accounts').select('id,name,industry')
        .or(`name.ilike.${s},industry.ilike.${s}`).limit(5),
      supabase.from('deals').select('id,name,stage,value')
        .ilike('name', s).limit(5),
    ]);
    res.json({
      leads:    leadsR.data    || [],
      contacts: contactsR.data || [],
      accounts: accountsR.data || [],
      deals:    dealsR.data    || [],
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Local dev only
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`CRM API at http://localhost:${PORT}`));
}

module.exports = app;
