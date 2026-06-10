# EduManage — School Education Management Platform

A full-stack internal platform for managing schools end-to-end: students, teachers, parents, classes, schedules, payments, and notifications.

## Tech Stack

- **Frontend**: React 19 + Vite + React Router + TanStack Query + PWA
- **Backend**: Node.js + Express + PostgreSQL 16
- **Hosting**: Vercel (monorepo)
- **Database**: PostgreSQL 16 (Supabase)

## Portals

| Portal | Audience | Access |
|---|---|---|
| Admin Dashboard | School staff | JWT login |
| Student Portal | Students | Token link |
| Teacher Portal | Teachers | Token link |
| Parent Portal | Parents | Email + password |

## Local Development

```bash
# 1. Start PostgreSQL via Docker
docker compose up -d

# 2. Configure backend environment
cd backend
cp .env.example .env
# Edit .env — set DATABASE_URL=postgresql://postgres:password@localhost:5432/school_management

# 3. Install dependencies and run migrations
npm install
npm run migrate

# 4. Seed demo data
npm run seed

# 5. Start backend (http://localhost:4000)
npm run dev

# 6. Start frontend (http://localhost:5173)
cd ../frontend
npm install
npm run dev
```

## Demo Accounts (password: `Password123!`)

| Email | Role |
|---|---|
| admin@school.com | Owner |
| manager@school.com | Manager |
| staff@school.com | Member |

## Project Structure

```
school-management/
├── backend/
│   └── src/
│       ├── routes/       # REST API route handlers
│       ├── services/     # Business logic
│       ├── jobs/         # Cron jobs
│       ├── migrations/   # SQL migration files
│       └── index.js      # Express entry point
└── frontend/
    └── src/
        ├── pages/        # Full-page React components
        ├── components/   # Reusable UI components
        ├── context/      # Auth context
        └── App.jsx       # Root router + layout
```

## Backup

```bash
pg_dump -U postgres school_management > backup_$(date +%Y%m%d).sql
```
