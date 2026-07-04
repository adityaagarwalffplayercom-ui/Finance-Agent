# Ledger — AI Executive Finance Team

This covers the first two slices of the platform: **account creation,
sign-in, a protected dashboard shell, and document upload**. It's real,
production-shaped code — not a mockup — but the dashboard still runs on
sample data until Step 4 (AI extraction from the uploaded documents) is
built on top of what's here.

## Stack

| Layer          | Choice                                    |
| -------------- | ------------------------------------------ |
| Framework      | Next.js 16 (App Router, Turbopack, React 19) |
| Language       | TypeScript                                 |
| Auth           | Better Auth (email + password, scrypt hashing, DB-backed sessions) |
| Database / ORM | PostgreSQL + Prisma 6                      |
| Styling        | Tailwind CSS v4 + hand-written design system (see `globals.css`) |

**Why these choices:**
- **Better Auth over Auth.js/rolling our own** — sessions and password
  hashing stay in your own Postgres database (no third-party auth service),
  with less hand-written security-sensitive code than a custom
  bcrypt/JWT/cookie implementation.
- **Prisma 6, not 7** — Prisma 7 requires driver adapters and a
  `prisma.config.ts` rewrite. Prisma 6's standard `PrismaClient` setup is
  simpler and fully supported; upgrading later is a contained change.
- **`proxy.ts`, not `middleware.ts`** — Next.js 16 renamed the convention.
  It also now runs on the Node.js runtime instead of the Edge runtime, so it
  can be extended with things like Prisma calls directly if you need them later.
- **No ESLint yet** — kept out to reduce moving parts for this first slice.
  Worth adding back (`npx eslint --init`) once the codebase grows.
- **Document upload is a Route Handler, not a Server Action** —
  `POST /api/documents` reads `request.formData()` directly. Server Actions
  have a documented issue in recent Next.js versions where large file
  uploads can silently drop their binary payload; a plain Route Handler
  sidesteps that failure mode entirely and is the pattern the file lands on
  if you search for "Next.js Server Action file upload dropped" today.
- **Uploaded files are stored as bytes in Postgres** (a `Bytes` column on
  `Document`), not in S3/R2/Vercel Blob. Zero extra accounts or environment
  variables needed to get upload working end-to-end on top of the Neon
  database you already have. This is genuinely fine for an MVP with a
  modest number of files per business, but Postgres isn't a great object
  store at scale — move `Document.content` to real object storage before
  this needs to hold thousands of large files. The `Document` model's other
  fields (name, size, category, status) wouldn't need to change, only where
  `content` points.

## Prerequisites

- Node.js 20+ (Node 22 LTS recommended)
- A PostgreSQL database — any of these work:
  - Local via Docker: `docker run --name ledger-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=finance_platform -p 5432:5432 -d postgres`
  - A local Postgres install
  - A free hosted instance (Neon, Supabase, Railway) — just copy their connection string

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env
# then edit .env:
#   DATABASE_URL              → your Postgres connection string
#   BETTER_AUTH_SECRET         → generate with: openssl rand -base64 32

# 3. Create the database tables
npx prisma migrate dev --name init

# 4. Run the dev server
npm run dev
```

> **Already had this project running before document upload existed?**
> Pull these files in, then run one more migration to add the `Document`
> table (and the `DocumentCategory`/`DocumentStatus` enums) to your existing
> Neon database:
> ```bash
> npx prisma migrate dev --name add_documents
> ```
> Everything else — your `.env`, your existing users — is untouched.

Visit `http://localhost:3000` — it redirects to `/signup` (well, `/login`,
with a link to sign up) since there's no session yet. Create an account and
you'll land on the dashboard.

## Project structure

```
prisma/schema.prisma          Better Auth's User/Session/Account/Verification
                               models, a Business model for onboarding (Step
                               2 — not built yet), and Document for uploads

proxy.ts                      Route protection: redirects signed-out users
                               away from /dashboard and /documents,
                               signed-in users away from /login and /signup

src/lib/auth.ts                Better Auth server config (Prisma adapter,
                               email/password provider)
src/lib/auth-client.ts        Better Auth React client (signIn, signUp,
                               signOut, useSession)
src/lib/prisma.ts             Prisma client singleton
src/lib/mock-data.ts          Placeholder dashboard data — swap this out
                               once real documents are being processed
src/lib/documents.ts          Server-side query for a user's documents
                               (excludes file bytes — metadata only)
src/lib/document-categories.ts Category list, allowed file types, size
                               limit, and format helpers — shared by the
                               upload form and the document list

src/components/Sidebar.tsx    Shared nav shell (used by every page under
                               the (app) route group)
src/components/Brand.tsx      The "Ledger" mark

src/app/login, /signup        Auth forms
src/app/(app)/layout.tsx      Fetches the session once, renders Sidebar
                               around whichever page is active
src/app/(app)/dashboard       Protected dashboard + its components
                               (HealthGauge, StatCard, CashFlowChart,
                               AlertsPanel)
src/app/(app)/documents       Protected documents page: UploadForm
                               (drag-and-drop + category picker),
                               DocumentList, DocumentRow (view/delete)

src/app/api/auth/[...all]     Better Auth's catch-all API route
src/app/api/documents         POST to upload (Route Handler, see "why
                               these choices" above for why not a Server
                               Action)
src/app/api/documents/[id]    GET streams a file back (view/download),
                               DELETE removes it — both check ownership
```

## Known gaps (by design, for this pass)

- **Email verification is off** (`requireEmailVerification: false` in
  `src/lib/auth.ts`). Turn it on once a transactional email provider
  (Resend, Postmark, etc.) is wired up — otherwise signups will never be
  able to verify.
- **Dashboard still shows sample data.** Uploading documents doesn't change
  the numbers on `/dashboard` yet — `src/lib/mock-data.ts` is still what
  renders there. Step 4 (AI extraction from what's now uploadable) is what
  replaces it with a real financial profile.
- **No document processing.** Every upload sits at `status: UPLOADED`
  forever right now — there's no OCR/extraction pipeline reading them yet.
  The `DocumentStatus` enum (`PROCESSING`, `PROCESSED`, `FAILED`) exists
  specifically so Step 4 has somewhere to report progress without another
  schema change.
- **"Ask your team" is still visible in the sidebar as "Soon"** —
  intentionally not linked anywhere yet (that's Step 8, chat).
- **No password reset flow.** Better Auth supports it; it just isn't wired
  up in this pass.
- **No onboarding form.** The `Business` model exists in the schema so the
  data has somewhere to go, but the Step 2 onboarding UI itself isn't built.

## Suggested next slice

Step 4 — actually reading the uploaded documents (OCR/extraction for bank
statements and invoices, building the structured financial profile from
them) — is what turns the dashboard from sample data into something real.
It's the natural next piece since both the `Document` table and the
dashboard UI are already waiting on it.
