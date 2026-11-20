# Wedding Family Planner

An independent wedding planning and family expense command centre for Ashikha and Afzal. This project is intentionally separate from the existing wedding invitation website: it has its own frontend, Node.js backend, SQLite database, routes, configuration and deployment files.

## What is included

- Dashboard for wedding spend, advances, outstanding balances, tasks, guests and upcoming dates.
- Editable Mehendi, Nikah/Wedding Ceremony and Reception events preloaded from the invitation project.
- CRUD screens for expenses, vendors, tasks, train/car travel, accommodation, guests, house construction and family expenses.
- Food & Catering and Costumes & Jewellery views backed by the expense ledger.
- Indian Rupee formatting, Asia/Kolkata timezone and responsive mobile navigation.
- Calendar agenda for events, task deadlines and payment due dates.
- CSV exports, JSON backup/restore and confirmation before deleting records.
- Persistent SQLite storage in `data/planner.sqlite`.

## Wedding information preloaded

- Nikah / wedding: 9 January 2027, 4:00 PM, Athafy Auditorium, Vadakara, Kerala.
- Reception: 14 January 2027, 6:00 PM, Eden Garden Convention Centre, Pandalam, Pathanamthitta, Kerala.
- Mehendi: 8 January 2027, evening, family residence, Hennas House, Vanimel, Kozhikkode. This was not specified in the invitation, so it is clearly editable.
- Bride: Dr. Ashikha Hashim.
- Groom: Dr. Afzal Muhammed Fysel.

The original invitation project was inspected read-only for these facts and is not imported at runtime. RSVP rows can be entered manually in this standalone planner; no invitation routes, Google Apps Script, database or runtime are shared.

## Run locally

Requires Node.js 22 or newer (the server uses the built-in `node:sqlite` module).

```powershell
cd C:\Users\muham\Documents\Codex\2026-08-08\wedding-family-planner
npm start
```

Open http://localhost:4174. For auto-reload during development:

```powershell
npm run dev
```

Copy `.env.example` to `.env` if you want to change `PORT`, `DB_FILE` or `NODE_ENV`. The default database is `data/planner.sqlite`.

## Deploy independently

- **Render:** the included `render.yaml` provisions a Node web service with a persistent disk mounted at `/app/data`, so SQLite survives restarts. The blueprint uses Render's `starter` plan because persistent disks require a disk-capable plan; change the plan if your host/account offers an equivalent.
- **Docker:** build and run the included Dockerfile:

```powershell
docker build -t wedding-family-planner .
docker run --name wedding-family-planner -p 4174:4174 -v planner-data:/app/data wedding-family-planner
```

Any Node host that can run `npm install` and `npm start` can host this as its own application and URL. Configure a persistent volume for `data/` in production.

## Backup and restore

Use **Settings → Download JSON backup** to export all planner records. The **Restore backup** control accepts that JSON file and replaces the local planner data in one transaction. Use the Reports page or table export buttons for CSV files.

## API overview

The backend exposes `/api/health`, `/api/summary`, `/api/settings`, `/api/backup`, `/api/restore`, `/api/export/:resource` and CRUD routes for `events`, `expenses`, `vendors`, `tasks`, `travel`, `accommodation`, `guests`, `construction` and `familyExpenses`.
