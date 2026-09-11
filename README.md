# Client-Tracker

Track clients, contacts, and engagement status. A full-stack app: vanilla JS frontend, Express API, SQLite database, and token-based auth — designed so Proposal-Builder, Invoice-Generator, and Scheduling-Tool can integrate with it later via the REST API.

## Features

- Client CRUD (name, company, email, phone, status, tags, notes)
- Status workflow: lead → active → past → lost
- Search across name, company, email, and tags
- Filter by status
- Multi-user ready: register/login with hashed passwords (scrypt) and bearer tokens
- REST API as the integration surface for other tools

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
│   ├── db.js             # SQLite schema (users, sessions, clients)
│   ├── auth.js           # register/login + bearer-token middleware
│   └── routes/clients.js # Client CRUD API
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

All `/api/clients` endpoints require `Authorization: Bearer <token>`.

### Clients

| Method | Path | Description |
|---|---|---|
| GET | `/api/clients?search=&status=` | List clients (newest first). `search` matches name/company/email/tags; `status` is `lead` \| `active` \| `past` \| `lost` |
| GET | `/api/clients/:id` | Get one client |
| POST | `/api/clients` | Create. Body: `{ name, company?, email?, phone?, status?, tags?, notes? }` |
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
  "notes": "Prefers email contact.",
  "created_at": "2026-09-11 12:00:00",
  "updated_at": "2026-09-11 12:00:00"
}
```

### Example: integrate from another tool

```bash
# 1. Get a token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"yourpassword"}' | jq -r .token)

# 2. Look up a client
curl -s "http://localhost:3000/api/clients?search=Acme" \
  -H "Authorization: Bearer $TOKEN"
```

## Scaling path

- **Local → multi-user:** the schema already separates data per user (`clients.user_id`); deploy the same server behind a reverse proxy and it serves many users.
- **SQLite → Postgres:** swap `server/db.js` for a Postgres client; the API contract stays identical.
- **Shared backend across tools:** when Proposal-Builder, Invoice-Generator, and Scheduling-Tool need auth/data too, extract this server into a shared service — the API is already the contract.

## Roadmap

- [x] Client CRUD with search and status filter
- [x] Auth (register/login, per-user data)
- [x] REST API for tool integration
- [ ] Follow-up reminders
- [ ] Import/export (CSV)
- [ ] Postgres adapter