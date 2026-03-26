const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');

function getOAuthClient() {
  const db = getDb();
  const clientId = db.prepare("SELECT value FROM settings WHERE key='gmail_client_id'").get()?.value;
  const clientSecret = db.prepare("SELECT value FROM settings WHERE key='gmail_client_secret'").get()?.value;
  const redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3001/api/gmail/callback';

  if (!clientId || !clientSecret) return null;

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// GET auth status
router.get('/status', (req, res) => {
  const db = getDb();
  const token = db.prepare("SELECT value FROM settings WHERE key='gmail_tokens'").get()?.value;
  const email = db.prepare("SELECT value FROM settings WHERE key='gmail_email'").get()?.value;
  const clientId = db.prepare("SELECT value FROM settings WHERE key='gmail_client_id'").get()?.value;

  res.json({
    configured: !!clientId,
    connected: !!token,
    email: email || null,
  });
});

// POST save credentials
router.post('/credentials', (req, res) => {
  const db = getDb();
  const { client_id, client_secret } = req.body;
  if (!client_id || !client_secret) return res.status(400).json({ error: 'client_id and client_secret required' });

  const upsert = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP");
  upsert.run('gmail_client_id', client_id);
  upsert.run('gmail_client_secret', client_secret);

  res.json({ success: true });
});

// GET auth URL
router.get('/auth', (req, res) => {
  const oauth2Client = getOAuthClient();
  if (!oauth2Client) return res.status(400).json({ error: 'Gmail credentials not configured' });

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/userinfo.email'],
    prompt: 'consent',
  });

  res.json({ url });
});

// GET OAuth callback
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('No authorization code');

  const oauth2Client = getOAuthClient();
  if (!oauth2Client) return res.status(400).send('Gmail not configured');

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user email
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    const db = getDb();
    const upsert = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP");
    upsert.run('gmail_tokens', JSON.stringify(tokens));
    upsert.run('gmail_email', data.email);

    res.send(`<html><body><script>window.close();</script><p>Gmail connected! You can close this window.</p></body></html>`);
  } catch (err) {
    res.status(500).send(`Error: ${err.message}`);
  }
});

// POST disconnect Gmail
router.post('/disconnect', (req, res) => {
  const db = getDb();
  db.prepare("DELETE FROM settings WHERE key IN ('gmail_tokens', 'gmail_email')").run();
  res.json({ success: true });
});

// POST sync emails and extract leads/contacts
router.post('/sync', async (req, res) => {
  const db = getDb();
  const tokenData = db.prepare("SELECT value FROM settings WHERE key='gmail_tokens'").get()?.value;
  if (!tokenData) return res.status(400).json({ error: 'Gmail not connected' });

  const oauth2Client = getOAuthClient();
  if (!oauth2Client) return res.status(400).json({ error: 'Gmail not configured' });

  oauth2Client.setCredentials(JSON.parse(tokenData));

  // Refresh token if needed
  oauth2Client.on('tokens', (tokens) => {
    const existing = JSON.parse(tokenData);
    const updated = { ...existing, ...tokens };
    db.prepare("INSERT INTO settings (key, value) VALUES ('gmail_tokens', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(updated));
  });

  try {
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const maxResults = req.body.max_results || 50;

    // Get recent messages
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      q: 'is:inbox -from:me',
    });

    const messages = listRes.data.messages || [];
    const results = { processed: 0, new_leads: 0, new_contacts: 0, new_threads: 0 };

    for (const msg of messages) {
      try {
        // Check if already processed
        const existing = db.prepare('SELECT id FROM email_threads WHERE gmail_message_id = ?').get(msg.id);
        if (existing) continue;

        const msgData = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date'] });

        const headers = msgData.data.payload?.headers || [];
        const from = headers.find(h => h.name === 'From')?.value || '';
        const subject = headers.find(h => h.name === 'Subject')?.value || '(No subject)';
        const date = headers.find(h => h.name === 'Date')?.value || '';

        // Parse "Name <email>" format
        const emailMatch = from.match(/<([^>]+)>/) || from.match(/([^\s]+@[^\s]+)/);
        const nameMatch = from.match(/^"?([^"<]+)"?\s*</);
        const senderEmail = emailMatch ? emailMatch[1].trim() : from.trim();
        const senderName = nameMatch ? nameMatch[1].trim() : senderEmail.split('@')[0];

        if (!senderEmail || !senderEmail.includes('@')) continue;

        // Skip no-reply / automated emails
        if (senderEmail.match(/no-?reply|noreply|donotreply|automated|mailer-daemon/i)) continue;

        const threadId = uuidv4();

        // Store email thread
        db.prepare(`
          INSERT OR IGNORE INTO email_threads (id, gmail_thread_id, gmail_message_id, subject, sender_email, sender_name, snippet, received_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(threadId, msgData.data.threadId, msg.id, subject, senderEmail, senderName, msgData.data.snippet || '', date);
        results.new_threads++;

        // Check if contact exists
        let contact = db.prepare('SELECT id FROM contacts WHERE email = ?').get(senderEmail);
        if (!contact) {
          // Check if lead exists
          let lead = db.prepare('SELECT id FROM leads WHERE email = ?').get(senderEmail);
          if (!lead) {
            const nameParts = senderName.split(' ');
            const leadId = uuidv4();
            db.prepare(`
              INSERT INTO leads (id, first_name, last_name, email, source, status)
              VALUES (?, ?, ?, ?, 'gmail', 'new')
            `).run(leadId, nameParts[0] || senderName, nameParts.slice(1).join(' ') || '', senderEmail);
            lead = { id: leadId };
            results.new_leads++;
          }
          // Update thread with lead ref
          db.prepare('UPDATE email_threads SET lead_id=? WHERE id=?').run(lead.id, threadId);
        } else {
          db.prepare('UPDATE email_threads SET contact_id=? WHERE id=?').run(contact.id, threadId);
        }

        results.processed++;
      } catch (msgErr) {
        // Skip individual message errors
      }
    }

    res.json({ success: true, ...results });
  } catch (err) {
    res.status(500).json({ error: 'Sync failed', details: err.message });
  }
});

// GET email threads
router.get('/threads', (req, res) => {
  const db = getDb();
  const threads = db.prepare(`
    SELECT et.*,
    c.first_name || ' ' || c.last_name as contact_name,
    l.first_name || ' ' || l.last_name as lead_name
    FROM email_threads et
    LEFT JOIN contacts c ON et.contact_id = c.id
    LEFT JOIN leads l ON et.lead_id = l.id
    ORDER BY et.received_at DESC
    LIMIT 100
  `).all();
  res.json(threads);
});

module.exports = router;
