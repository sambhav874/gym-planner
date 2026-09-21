# Formwork

Formwork is a mobile-first shared training-plan workspace. It turns trainer Excel workbooks into a reviewable daily schedule with workout logging, diet guidance, progress views, and group activity.

## Current implementation

- Responsive dashboard for a shared training group.
- Individual plan view with day navigation and set-by-set logging stored in browser local storage.
- Diet and guidance views.
- Progress charts and group activity view.
- Excel import API and review UI.
- Local demo-mode draft and publish controls with member assignment and start date.
- Pre-seeded group members:
  - Sambhav Jain → `data/Sambhav Workout and Diet Plan.xlsx`
  - Shivam → `data/23 M Short client workout plan.xlsx`
- Both seeded plans start on Monday, 14 September 2026, with visible calendar dates for every day.
- Upload support for `.xlsx` and `.csv` files.
- Parser support for both supplied workbook shapes:
  - `23 M Short client workout plan.xlsx`
  - `Sambhav Workout and Diet Plan.xlsx`
- Parser tests that validate the expected 30-day and 209-exercise outputs.

The app runs in demo mode without external credentials. Set logs, imported drafts, and published plans use browser local storage so the main flow is testable immediately. The Supabase schema foundation is in `supabase/migrations/20260922000000_initial_schema.sql`; the application persistence/auth wiring can be enabled after applying that migration.

## Run locally

Prerequisites: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verify

```bash
npm test
npm run typecheck
npm run build
```

## Routes

- `/` — shared group overview
- `/plan/sambhav` — Sambhav’s interactive daily plan, diet, and guidance
- `/plan/shivam` — Shivam’s interactive daily plan, diet, and guidance
- `/plan/:memberId` — group member plan view
- `/progress` — progress charts
- `/import` — workbook/CSV upload and normalized preview
- `POST /api/imports` — parse an uploaded workbook and return the normalized plan

## Production integration seam

Create a Supabase project named Formwork, run the SQL migration in the Supabase SQL Editor, enable email magic-link authentication, and add `NEXT_PUBLIC_SUPABASE_URL` plus `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from `.env.example`. Never add the database password or a service-role key to `NEXT_PUBLIC_*` variables or commit them. The app currently keeps its demo fallback in local storage until persistence/auth wiring is enabled.
