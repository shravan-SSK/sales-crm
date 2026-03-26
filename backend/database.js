const Database = require('better-sqlite3');
const path = require('path');
// DB_PATH env var takes precedence; falls back to /data in production (needs disk) or __dirname locally.
const DB_PATH = process.env.DB_PATH || (
  process.env.NODE_ENV === 'production'
      ? '/data/crm.db'
          : path.join(__dirname, 'crm.db')
          );

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      website TEXT,
      industry TEXT,
      company_size TEXT,
      phone TEXT,
      address TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT UNIQUE,
      phone TEXT,
      title TEXT,
      account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
      linkedin_url TEXT,
      linkedin_data TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      company TEXT,
      title TEXT,
      source TEXT DEFAULT 'manual',
      status TEXT DEFAULT 'new',
      notes TEXT,
      converted_to_contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS deals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
      contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
      stage TEXT DEFAULT 'lead',
      value REAL DEFAULT 0,
      probability INTEGER DEFAULT 0,
      close_date TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS deal_stakeholders (
      id TEXT PRIMARY KEY,
      deal_id TEXT REFERENCES deals(id) ON DELETE CASCADE,
      contact_id TEXT REFERENCES contacts(id) ON DELETE CASCADE,
      role TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      subject TEXT NOT NULL,
      description TEXT,
      deal_id TEXT REFERENCES deals(id) ON DELETE CASCADE,
      contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
      lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL,
      due_date TEXT,
      completed INTEGER DEFAULT 0,
      completed_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS email_threads (
      id TEXT PRIMARY KEY,
      gmail_thread_id TEXT UNIQUE,
      gmail_message_id TEXT,
      subject TEXT,
      sender_email TEXT,
      sender_name TEXT,
      snippet TEXT,
      body TEXT,
      received_at TEXT,
      contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
      lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL,
      deal_id TEXT REFERENCES deals(id) ON DELETE SET NULL,
      processed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
    CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
    CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
    CREATE INDEX IF NOT EXISTS idx_activities_due_date ON activities(due_date);
    CREATE INDEX IF NOT EXISTS idx_activities_completed ON activities(completed);
  `);
}

module.exports = { getDb };
