const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../lib/supabase');

async function getSetting(key) {
  const { data } = await supabase.from('settings').select('value').eq('key', key).maybeSingle();
  return data?.value || null;
}

async function upsertSetting(key, value) {
  await supabase.from('settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
}

async function getOAuthClient() {
  const clientId     = await getSetting('gmail_client_id');
  const clientSecret = await getSetting('gmail_client_secret');
  const redirectUri  = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3001/api/gmail/callback';
  if (!clientId || !clientSecret) return null;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// GET auth status
router.get('/status', async (req, res) => {
  try {
    const [token, email, clientId] = await Promise.all([
      getSetting('gmail_tokens'), getSetting('gmail_email'), getSetting('gmail_client_id'),
    ]);
    res.json({ configured: !!clientId, connected: !!token, email: email || null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST save credentials
router.post('/credentials', async (req, res) => {
  try {
    const { client_id, client_secret } = req.body;
    if (!client_id || !client_secret) return res.status(400).json({ error: 'client_id and client_secret required' });
    await Promise.all([upsertSetting('gmail_client_id', client_id), upsertSetting('gmail_client_secret', client_secret)]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET auth URL
router.get('/auth', async (req, res) => {
  try {
    const oauth2Client = await getOAuthClient();
    if (!oauth2Client) return res.status(400).json({ error: 'Gmail credentials not configured' });
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/userinfo.email'],
      prompt: 'consent',
    });
    res.json({ url });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send('No authorization code');
    const oauth2Client = await getOAuthClient();
    if (!oauth2Client) return res.status(400).send('Gmail not configured');
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();
    await Promise.all([upsertSetting('gmail_tokens', JSON.stringify(tokens)), upsertSetting('gmail_email', data.email)]);
    res.send('<html><body><script>window.close();</script><p>Gmail connected! You can close this window.</p></body></html>');
  } catch (err) { res.status(500).send(`Error: ${err.message}`); }
});

// POST disconnect
router.post('/disconnect', async (req, res) => {
  try {
    await supabase.from('settings').delete().in('key', ['gmail_tokens', 'gmail_email']);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST sync emails
router.post('/sync', async (req, res) => {
  try {
    const tokenData = await getSetting('gmail_tokens');
    if (!tokenData) return res.status(400).json({ error: 'Gmail not connected' });
    const oauth2Client = await getOAuthClient();
    if (!oauth2Client) return res.status(400).json({ error: 'Gmail not configured' });
    oauth2Client.setCredentials(JSON.parse(tokenData));
    oauth2Client.on('tokens', async (tokens) => {
      const updated = { ...JSON.parse(tokenData), ...tokens };
      await upsertSetting('gmail_tokens', JSON.stringify(updated));
    });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const maxResults = req.body.max_results || 50;
    const listRes = await gmail.users.messages.list({ userId: 'me', maxResults, q: 'is:inbox -from:me' });
    const messages = listRes.data.messages || [];
    const results = { processed: 0, new_leads: 0, new_contacts: 0, new_threads: 0 };

    for (const msg of messages) {
      try {
        const { data: existing } = await supabase.from('email_threads').select('id').eq('gmail_message_id', msg.id).maybeSingle();
        if (existing) continue;
        const msgData = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date'] });
        const headers     = msgData.data.payload?.headers || [];
        const from        = headers.find(h => h.name === 'From')?.value    || '';
        const subject     = headers.find(h => h.name === 'Subject')?.value || '(No subject)';
        const date        = headers.find(h => h.name === 'Date')?.value    || '';
        const emailMatch  = from.match(/<([^>]+)>/) || from.match(/([^\s]+@[^\s]+)/);
        const nameMatch   = from.match(/^"?([^"<]+)"?\s*</);
        const senderEmail = emailMatch ? emailMatch[1].trim() : from.trim();
        const senderName  = nameMatch  ? nameMatch[1].trim()  : senderEmail.split('@')[0];
        if (!senderEmail || !senderEmail.includes('@')) continue;
        if (senderEmail.match(/no-?reply|noreply|donotreply|automated|mailer-daemon/i)) continue;

        const threadId = uuidv4();
        await supabase.from('email_threads').upsert({
          id: threadId, gmail_thread_id: msgData.data.threadId, gmail_message_id: msg.id,
          subject, sender_email: senderEmail, sender_name: senderName,
          snippet: msgData.data.snippet || '', received_at: date,
        }, { onConflict: 'gmail_thread_id', ignoreDuplicates: true });
        results.new_threads++;

        const { data: contact } = await supabase.from('contacts').select('id').eq('email', senderEmail).maybeSingle();
        if (contact) {
          await supabase.from('email_threads').update({ contact_id: contact.id }).eq('id', threadId);
        } else {
          const { data: lead } = await supabase.from('leads').select('id').eq('email', senderEmail).maybeSingle();
          if (lead) {
            await supabase.from('email_threads').update({ lead_id: lead.id }).eq('id', threadId);
          } else {
            const nameParts = senderName.split(' ');
            const leadId = uuidv4();
            await supabase.from('leads').insert({
              id: leadId, first_name: nameParts[0] || senderName,
              last_name: nameParts.slice(1).join(' ') || '',
              email: senderEmail, source: 'gmail', status: 'new',
            });
            await supabase.from('email_threads').update({ lead_id: leadId }).eq('id', threadId);
            results.new_leads++;
          }
        }
        results.processed++;
      } catch { /* skip individual errors */ }
    }
    res.json({ success: true, ...results });
  } catch (err) { res.status(500).json({ error: 'Sync failed', details: err.message }); }
});

// GET email threads
router.get('/threads', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('email_threads')
      .select('*, contacts(first_name,last_name), leads(first_name,last_name)')
      .order('received_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    res.json((data || []).map(t => ({
      ...t,
      contact_name: t.contacts ? `${t.contacts.first_name} ${t.contacts.last_name}` : null,
      lead_name:    t.leads    ? `${t.leads.first_name} ${t.leads.last_name}`        : null,
      contacts: undefined, leads: undefined,
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
