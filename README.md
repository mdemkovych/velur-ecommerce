# VELUR — e-commerce storefront and admin panel

[![checks](https://github.com/mdemkovych/velur-ecommerce/actions/workflows/checks.yml/badge.svg)](https://github.com/mdemkovych/velur-ecommerce/actions/workflows/checks.yml)

![Next.js](https://img.shields.io/badge/Next.js-16_App_Router-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-087EA4?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Auth_&_Storage-3FCF8E?logo=supabase&logoColor=white)
![Redux](https://img.shields.io/badge/Redux_Toolkit-2-764ABC?logo=redux&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-v4-3E67B1?logo=zod&logoColor=white)
![sharp](https://img.shields.io/badge/sharp-image_pipeline-99CC00?logo=sharp&logoColor=white)

A production online shop for a cosmetics brand: storefront, basket, checkout
paid through Monobank, delivery to a Nova Poshta branch, and an admin panel for
products, orders, banners and a staff journal.

**[▶ Live demo](https://velur-ecommerce.vercel.app)**  ·  11 tables · 21 migrations · 34 API routes · 24 pages · 140 unit tests, 15 more against a real database

> **About this repository.** This is a production e-commerce shop built for a Ukrainian
> cosmetics brand, published here as a portfolio copy. The brand's name, logo and
> photography are stand-ins — VELUR is not the real name — and the seller's
> registration details are placeholders. The architecture, the code and the decisions
> are the ones that run. The interface is translated into English; the live shop serves
> Ukrainian customers in Ukrainian.

---

## Demo access

The storefront is open. The admin panel needs an account, and one is published
here on purpose:

| | |
|---|---|
| **Sign in** | [velur-ecommerce.vercel.app/auth/login](https://velur-ecommerce.vercel.app/auth/login) |
| **Email** | `reviewer@example.com` |
| **Password** | `kaVgeg-qibdum-vetry3` |
| **2FA secret** | `PV2LUEQ5LCEKQR3RTBB5FMSMZTWDZ3UP` |

Add that secret to any authenticator app and it will produce the six-digit code
the sign-in asks for.

**The second factor is published deliberately, and that is the point.** A
password is not a session here: `getSessionUser()` returns `null` for a
password-only session on an account that has a verified factor, so every guard
refuses it. Handing out the password alone would open nothing.

This account is a **manager**, not the owner. It can work orders, edit the
catalogue and read the journal; it cannot add or deactivate anyone, reset
another factor, or delete a journal entry — those belong to the owner, and the
journal records what managers did.

Orders are real: placing one reserves stock, and the checkout takes a card
through Monobank's test environment. Nothing is charged.

---

## What is worth looking at

The shop is small; the interesting part is what it refuses to do.

**Money is never taken from the client.** `POST /api/orders` accepts only
`{productId, quantity}[]`. Prices and totals are resolved server-side from the
catalogue, so a substituted sum in the request is ignored — see
[`src/lib/db/orders.ts`](src/lib/db/orders.ts).

**One function may write `PAID`, and it has exactly two callers.** A shopper can open
any URL, so nothing a browser sends is evidence. Every path goes through
[`applyPayment()`](src/lib/payments.ts), which checks the amount, the currency and the
invoice id against what the server computed, and writes an audit entry either way. A
mismatch is answered `200` with a flag raised on the order, because a webhook retry
cannot fix a mismatch.

**Two shoppers cannot buy the same last unit.** Stock is reserved inside a transaction
with `stock >= quantity` in the WHERE clause, so checking and decrementing are one
atomic statement. The same basket from the same phone answers with the order that
already exists, guarded by `pg_advisory_xact_lock` — because looking and writing are
two steps, and two requests arriving together both look before either writes.

**Uploads are re-encoded, never trusted.** `file.type` is a client-supplied header and
decides nothing: images go through `sharp` to WebP (which strips EXIF and fails on
anything that is not an image), and video is matched against its container's magic
bytes. See [`src/app/api/upload/route.ts`](src/app/api/upload/route.ts).

**Order periods are computed in Kyiv time, always.** The deployment region's midnight
is hours away from the shop's, so a naive `new Date(y, m, d)` counts late-evening orders
as yesterday's and reports a figure that is merely low, never wrong enough to fail. Pure
functions, covered by tests including the two nights a year the clocks move —
[`src/lib/orderPeriods.ts`](src/lib/orderPeriods.ts).

## Documentation

- [`docs/project-overview.md`](docs/project-overview.md) — the product in plain
  language: pages, data, the rules the shop runs by. Start here.
- [`docs/architecture.md`](docs/architecture.md) — the source of truth for how the shop
  is built. Sections are numbered, and comments in the code cite them: `§3.5`, `§4.3`.

That citation habit is enforced rather than hoped for: a `NOTE:` in the code must carry
a `§`, and the section it names must exist.

## Requirements

Node 24, npm, and a PostgreSQL database. The project is built against Supabase, which
also provides Auth and the bucket the product media lives in.

## Getting started

```bash
npm install
cp .env.example .env.local        # fill in the database and Supabase keys
npx prisma generate               # nothing generates the client on install
npx prisma migrate deploy         # create the tables
npm run create-owner -- you@example.com "Name"
npm run dev                       # http://localhost:3000
```

**There is no sign-up form, and there should not be one.** The first owner is made
from a terminal, where the service-role key already lives — anyone who can run that
command already holds the database, so it grants nothing it did not have. It refuses
once an active owner exists, which is what stops it becoming a way to escalate later,
and every account after the first is created by the owner from `/admin/team`.

**`migrate deploy`, not `migrate dev`.** The first applies the migrations that exist and
does nothing else. The second is for changing the schema: it compares the schema against
the migrations and offers to **reset the database** when they have drifted.

**Without `MONOBANK_API_TOKEN` the checkout takes no orders at all** and says so before
anyone types — card payment is the only method, so an order nobody can pay for is never
created. Without the Nova Poshta key the site still works: the address directory
switches off and the city and branch are typed by hand.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | development server |
| `npm run build` | production build |
| `npm run lint` | ESLint, type-aware |
| `npm run typecheck` | types only, no build |
| `npm run test` | pure functions: money, statuses, validation, badges. No database, no network, under a second |
| `npm run test:db` | `createOrder` and `applyPayment` against a **real** database |

`test:db` is a separate command deliberately. `npm run test` globs `src/**/*.test.ts`
only, so it stays safe to run anywhere without thinking. It also demands an explicit
opt-in:

```bash
ALLOW_DB_TESTS=1 npm run test:db
```

### Operator scripts

| Command | What it does |
|---|---|
| `npm run create-owner -- <email> "<name>"` | the first owner; refuses once an active one exists |
| `npm run update-account -- <email> [--email <new>] [--name "<new>"]` | change a sign-in address or the name shown in the journal |
| `npm run sync-novaposhta` | refresh the city and branch directory now |
| `npm run backup` | snapshot the database and the photographs into `backup/` |

**Nothing here deletes anything.** A departing manager is deactivated rather than
deleted, so audit entries keep pointing at a real person.

## Scheduled jobs

Three entries in `vercel.json`. They have no interface and do not complain; when they
stop running, only the consequences show.

| Route | If it does not run |
|---|---|
| `/api/cron/expire-orders` | stock reserved by abandoned checkouts never returns to the shelf |
| `/api/cron/scrub-personal-data` | personal data on old orders is never erased, though the privacy policy promises it |
| `/api/cron/sync-novaposhta` | the branch directory goes stale silently, and a customer picks a counter that has closed |

All three are guarded by `CRON_SECRET` and answer 403 without it.

The schedules here are daily. The production shop sweeps expiring orders every ten
minutes — a free Vercel plan rejects anything more frequent, and refuses the deployment
outright rather than degrading. All three still run on it: the plan limits how
often a cron may fire, not how many a project may have.

## Environment variables

The full list, with reasoning, is in [`.env.example`](.env.example). All of them are
server-side; **no variable carries a `NEXT_PUBLIC_` prefix**, including the Supabase
anon key — which is why sign-in happens in a route handler rather than in the browser.

**Required:** `DATABASE_URL`, `DIRECT_URL`, the three `SUPABASE_*` keys, `APP_URL`,
`PAYMENT_TOKEN_SECRET`, `CRON_SECRET`.

`DATABASE_URL` and `DIRECT_URL` are not interchangeable. The first is the transaction
pooler (6543) the application runs on; the second is the session pooler (5432)
migrations need, because the transaction pooler cannot hold the locks `prisma migrate`
takes.

Everything else degrades quietly: without Resend, TurboSMS or Telegram keys the
corresponding message is simply not sent, and the payment webhook still answers 200.

## License

Proprietary. All rights reserved.
