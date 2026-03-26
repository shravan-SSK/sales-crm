# Sales CRM

A simple, full-featured Sales CRM built with React + Node.js + SQLite.

## Features
- **Leads** — Auto-imported from Gmail or added manually. Convert leads to contacts.
- **Contacts** — Full profiles with LinkedIn scanning, deal history, and activity log.
- **Accounts** — Companies with contact counts, deal value, and pipeline summary.
- **Pipeline (Kanban)** — Drag-and-drop deal management across 6 stages. Auto-logs stage changes.
- **Revenue Forecast** — Weighted and committed forecast for 6 months with area charts.
- **Activities** — Log calls, emails, meetings, tasks. Overdue alerts and stale-deal detection.
- **Gmail Sync** — OAuth2 integration. Scans inbox and auto-creates leads/contacts from email threads.
- **LinkedIn Scanner** — Paste a LinkedIn URL to enrich a contact's profile with public data.
- **Global Search** — Search across leads, contacts, accounts, and deals instantly.

## Quick Start

### Prerequisites
- Node.js 18+
- npm

### 1. Install dependencies

```bash
# From the sales-crm root:
cd backend && npm install
cd ../frontend && npm install
```

### 2. Start the backend

```bash
cd backend
cp .env.example .env   # optional: edit ports
node server.js
# API running at http://localhost:3001
```

### 3. Start the frontend

```bash
cd frontend
npm run dev
# UI running at http://localhost:5173
```

Open http://localhost:5173 in your browser.

---

## Gmail Integration Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a project and enable the **Gmail API**
3. Create **OAuth 2.0 credentials** (Web Application type)
4. Add `http://localhost:3001/api/gmail/callback` as an authorized redirect URI
5. In the CRM, go to **Settings** → enter your Client ID and Secret → click Connect Gmail
6. Go to **Email Inbox** → click **Sync Now** to import leads from your inbox

---

## LinkedIn Scanner

In the Contacts page, click any contact → paste their LinkedIn URL → click **Scan Profile**.

This extracts publicly available data (name, headline, company) via Open Graph meta tags.
For complete profile enrichment, integrate [Proxycurl API](https://nubela.co/proxycurl).

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/leads` | List / create leads |
| PUT/DELETE | `/api/leads/:id` | Update / delete lead |
| POST | `/api/leads/:id/convert` | Convert lead → contact |
| GET/POST | `/api/contacts` | List / create contacts |
| POST | `/api/contacts/:id/linkedin-scan` | Scan LinkedIn profile |
| GET/POST | `/api/accounts` | List / create accounts |
| GET/POST | `/api/deals` | List / create deals |
| GET | `/api/deals/pipeline` | Kanban pipeline data |
| GET | `/api/deals/forecast` | Revenue forecast |
| POST | `/api/deals/:id/stakeholders` | Add stakeholder |
| GET/POST | `/api/activities` | List / create activities |
| GET | `/api/activities/reminders` | Overdue + upcoming |
| GET | `/api/gmail/status` | Gmail connection status |
| POST | `/api/gmail/sync` | Sync Gmail inbox |
| GET | `/api/dashboard/stats` | Dashboard statistics |
| GET | `/api/search?q=` | Global search |

---

## Database

SQLite database stored at `backend/crm.db`. Tables:
- `leads`, `contacts`, `accounts`, `deals`
- `deal_stakeholders`, `activities`, `email_threads`, `settings`
