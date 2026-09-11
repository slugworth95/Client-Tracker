# Client-Tracker

Track clients, contacts, and engagement status. A full-stack app: vanilla JS frontend with a kanban board, Express API, SQLite database, and token-based auth — designed so Proposal-Builder, Invoice-Generator, and Scheduling-Tool can integrate with it later via the REST API.

## Features

- **Kanban board** — Lead / Active / Past / Lost columns with live counts; drag cards between columns to update status
- **Board ⇄ List toggle** — dense list view as an alternative
- **Client profiles** — name, company, email, phone, status, tags; fully editable in place (no duplicate entries)
- **Custom fields** — define your own profile fields (text / number / date, optional required) per business need; they appear on every client
- **Timestamped notes** — per-client notes with timestamps, add/delete
- **Search** — across name, company, email, and tags
- **Multi-user ready** — register/login with hashed passwords (scrypt) and bearer tokens
- **REST API** — the integration surface for other tools

## Run locally

Requires Node.js 22.5+ (uses the built-in `node:sqlite` — no native dependencies).

```bash
npm install
npm start
```

Open http://localhost:3000. The SQLite database is created automatically in `data/` (gitignored).

- `npm start` — run the server
- `npm run dev` — run with auto-restart on file changes

## Project structure

```
Client-Tracker/
├── server/
│   ├── index.js          # Express app: static frontend + /api routes
│   ├── db.js             # SQLite schema (users, sessions, clients, custom_fields, notes)
│   ├── auth.js           # register/login + bearer-token middleware
│   └── routes/
│       ├── clients.js    # Client CRUD + custom-value validation
│       ├── customFields.js # Business-defined profile fields
│       └── notes.js      # Timestamped client notes
├── public/               # Frontend (served by Express)
│   ├── index.html
│   ├── css/styles.css
│   └── js/{api.js,app.js}
├── data/                 # SQLite file (created at runtime, gitignored)
└── package.json
```

## API reference

Base URL: `http://localhost:3000` (override with `PORT` env var).

### Health

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Service discovery: `{ service, status, version }` |

### Auth

| Method | Path | Body | Description |
|---|---|---|---|
| POST | `/api/auth/register` | `{ name, email, password }` | Create account (password ≥ 8 chars). Returns `{ user, token }` |
| POST | `/api/auth/login` | `{ email, password }` | Returns `{ user, token }` |

All endpoints below require `Authorization: Bearer <token>`.

### Clients

| Method | Path | Description |
|---|---|---|
| GET | `/api/clients?search=` | List clients (newest first). `search` matches name/company/email/tags |
| GET | `/api/clients/:id` | Get one client |
| POST | `/api/clients` | Create. Body: `{ name, company?, email?, phone?, status?, tags?, customValues? }` |
| PUT | `/api/clients/:id` | Update (partial updates allowed) |
| DELETE | `/api/clients/:id` | Delete |

Client shape:

```json
{
  "id": 1,
  "name": "Acme Corp",
  "company": "Acme Inc.",
  "email": "billing@acme.com",
  "phone": "555-0100",
  "status": "active",
  "tags": "web,retainer",
  "customValues": { "3": "GB123456789" },
  "created_at": "2026-09-11 12:00:00",
  "updated_at": "2026-09-11 12:00:00"
}
```

`customValues` is an object keyed by custom field id. Unknown keys are ignored; required fields are enforced; number fields are validated.

### Custom fields

| Method | Path | Description |
|---|---|---|
| GET | `/api/custom-fields` | List field definitions |
| POST | `/api/custom-fields` | Create. Body: `{ name, type: text\|number\|date, required? }` |
| PUT | `/api/custom-fields/:id` | Update a field definition |
| DELETE | `/api/custom-fields/:id` | Delete; values are stripped from all clients |

### Notes

| Method | Path | Description |
|---|---|---|
| GET | `/api/clients/:clientId/notes` | List notes (newest first), each with `created_at` timestamp |
| POST | `/api/clients/:clientId/notes` | Add note. Body: `{ body }` |
| DELETE | `/api/notes/:id` | Delete a note |

### Example: integrate from another tool

```bash
# 1. Get a token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"yourpassword"}' | jq -r .token)

# 2. Look up a client
curl -s "http://localhost:3000/api/clients?search=Acme" \
  -H "Authorization: Bearer $TOKEN"

# 3. Move a client to "active" (what the kanban board does on drop)
curl -s -X PUT http://localhost:3000/api/clients/1 \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"active"}'
```

## Scaling path

- **Local → multi-user:** the schema already separates data per user (`clients.user_id`); deploy the same server behind a reverse proxy and it serves many users.
- **SQLite → Postgres:** swap `server/db.js` for a Postgres client; the API contract stays identical.
- **Shared backend across tools:** when Proposal-Builder, Invoice-Generator, and Scheduling-Tool need auth/data too, extract this server into a shared service — the API is already the contract.

## Roadmap

- [x] Kanban board with drag-and-drop status updates
- [x] Client CRUD with search
- [x] Custom (business-defined) profile fields
- [x] Timestamped notes
- [x] Auth (register/login, per-user data)
- [x] REST API for tool integration
- [ ] Follow-up reminders
- [ ] Import/export (CSV)
- [ ] Postgres adapter