# Architecture and technical requirements

What has to be true about the shop: how it is put together, which rules may not
be broken, and why. Sections are numbered, and comments in the code cite them by
number: `§3.5`, `§4.3`.

**How the numbering works, because the code depends on it.**

- **A subsection is the unit a comment points at.** `§4` is a chapter, `§4.3` is
  a rule, and a reference that lands on a chapter is barely better than "see the
  documentation". Every section that runs to more than a handful of rules gets
  numbered subsections.
- **Items inside a subsection stay unnumbered.** A third level exists for a
  genuine sub-topic, as §3.6.1 and §5.1.1 are, and never as a running number for
  bullets: bullets are inserted and reordered constantly, so `§4.3.2` would come
  to mean a different rule without anything failing.
- **Numbers are append-only. Never renumber, never reuse.** A new subsection
  takes the next free number in its section and goes at the end of it, even when
  it would read better in the middle. §5.3 is there for exactly that reason. A
  number that moves sends every comment citing it to the wrong rule, and nothing
  in a build can see that happen.

> A non-technical description of the product is in `docs/project-overview.md`.

**Target stack:** Next.js (App Router), React, Prisma ORM, Supabase (PostgreSQL & Storage), Tailwind CSS, TypeScript, Zod, Upstash Redis.

**Actual stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4,
Redux Toolkit, Zod v4, sharp, **Prisma 7 with PostgreSQL on Supabase**, Supabase Auth.
The catalogue, orders, accounts, home-page banners and the audit log all live in
the database; media lives in Supabase Storage. `public/uploads/` holds only the
files uploaded before the move, and nothing new is written there.

**Phasing (worth knowing before you start: do not try to build all of it at once):**
- **MVP (phase 1) [done]:** product catalogue, basket, checkout paid through Monobank, a basic admin panel (products, orders), and the security items from section 3.
- **Phase 2 [mostly done]:** extended UX detail, local NP directory sync, 2FA/MFA, Telegram notifications on payment (§9.3), audit logs in full (§2.7), PII retention erasure (§3.6.1). (The box matrix was dropped from here, see §5; so was TTN generation, §5.1.1.)
- **Phase 3 [backlog]:** fiscalisation (PRRO), customer SMS/Viber notifications about waybills through the Nova Poshta API.

None of this cancels anything below. Everything stays in the spec; the phases
only make it possible to move in order rather than implement nine sections at
once.

---

## 1. Baseline code standards and architecture
### 1.1 Structure and typing
- **App Router:** the new architecture (`app/`) only. Components are server components by default; `'use client'` is added for interactivity and nothing else.
- **Strict typing (TypeScript + Zod):** no `any`. Every input (forms, API, webhooks) is validated through Zod schemas on the server and on the client.
- **Database access (Prisma):** `@supabase/supabase-js` must not be used for CRUD. Every query goes through the Prisma client in a server action or a route handler.

### 1.2 Secrets, and proxies that are narrow contracts
- **Secrets:** keys (Monobank, database, Nova Poshta) live in `.env` **without** the `NEXT_PUBLIC_` prefix.
- **Proxying:** the client never calls a third-party API directly (Nova Poshta, for instance). Every request goes through our own backend so the tokens stay hidden.

### 1.3 One source of truth for validation
- **[done] One source of truth for validation.** Every Zod schema lives in
  `src/lib/validation.ts` and is used by *both* the client form and the route
  handler. That removes the class of bug where client and server validate
  differently.
- **[done] No transparent proxies to third-party APIs.** `/api/delivery/*`
  exposes exactly **two** operations, a city search and a branch search; the
  price calculation went with delivery cost itself (§5). A client cannot pass an
  arbitrary `modelName` or `calledMethod` and cannot substitute its own
  `apiKey`: both are literals in `novaposhta.ts`, and the routes accept only `q`
  and `cityRef`, both length-limited. An extension of §1: a proxy is a narrow
  contract, not a tunnel.

  Why it matters here specifically: `modelName: "InternetDocument"` with
  `calledMethod: "save"` creates a waybill **billed to our account**. A
  transparent proxy would hand that to anyone with DevTools without ever
  revealing the key, because the server would supply it.

### 1.4 Integrations degrade gracefully
- **[done] Integrations degrade gracefully.** A missing Nova Poshta or Monobank
  key does not break the site: the directory switches off and the form falls back
  to manual entry, and online payment disappears from the checkout. No "demo
  modes" that simulate success.

### 1.5 Tests
- **[done] Pure unit tests.** `node:test` through `tsx` (not Vitest), in
  `src/lib/*.test.ts` beside what they cover. **Pure functions are covered**:
  money arithmetic, the transition table and `canRecordReturn`, validation
  (including a banner button's address and the media format), badges, the address
  hint, poster derivation, email/telegram message formatting and price diffs.
  They run in well under a second: no database, no network, no fixtures (`npm test`).
- **[done] Database and integration tests.** `npm run test:db` runs integration
  suites in `tests/db/` (`orders.test.ts`, `payments.test.ts`, `harness.ts`)
  against a live database. There is no rollback and no separate database to roll
  back to: every row is created by the fixture and deleted again in `cleanup`,
  and the suite refuses to start without `ALLOW_DB_TESTS=1`, printing which
  Supabase project it is about to write to.
- **[backlog] E2E checkout test:** one end-to-end Playwright run through the checkout.

### 1.6 Lint and CI
- **[backlog] CI.** `tsc --noEmit`, `eslint` and `next build` on every PR.
- **[done] Type-aware ESLint.** `@typescript-eslint/no-floating-promises`,
  `no-misused-promises` and `await-thenable` are on (`eslint.config.mjs`). That
  catches a missing `await` in async code, a mistake neither `tsc` nor an untyped
  lint sees, and one that on serverless means an unfinished write to the database.

---

## 2. Database modelling (Prisma schema)
### 2.1 Text content is plain text
- **Text content is plain text, with no rich-text editor.**
  A product's fields (`nameUk`, `description`, `usage`, `packaging`) are `String`
  and render as text. A manager needs line breaks, and line breaks work.
  - **There is no XSS vector, and that follows from this decision.** Nothing
    renders through `dangerouslySetInnerHTML`, so nothing needs sanitising. The
    requirement to add `DOMPurify` was dropped along with the editor, and it
    comes back **with the editor** if one is ever needed, not before.

### 2.2 Products have no variants
- **Products have no variants. Decided and closed.**
  A product is one thing with one price and one stock count. `price`,
  `promotionalPrice` and `stock` live on `Product`. The decision to support
  variants (volumes and shades on one page) was **reversed**: the range has none,
  and the model dragged a picker onto the card, a panel behind the picker, and
  half the complexity of the storefront with it.
  - **No `sku` column, deliberately.** Nothing reads one: Monobank takes a name,
    a quantity and a total; Nova Poshta wants a description of the contents;
    there is no warehouse system. Adding the column later is one command and no
    data migration.
  - **"Promotional price below the ordinary one" is checked in the form**, not
    in the database: the constraint cannot be expressed in the schema, and a
    "discount" upwards should not be possible.


### 2.3 Sets and their components
- **A set is its own stock item.**
  `product_components` describes **what is inside**, which the product page needs
  and which answers "which sets contain this cream". It is not a warehouse
  ledger: selling a set decrements the set's own stock and **leaves its
  components alone**, because sets are packed in advance and sit on the shelf as
  one thing. Do not "fix" this into decrementing components; a packed set would
  then take units off a shelf they have already left.

  **There is no `isSet` flag and there should not be one.** A set is a product
  that has contents, so emptying the list makes it an ordinary product again and
  a query for "which sets contain this cream" is the same query either way.
  Saving rewrites the list wholesale, so anything the payload no longer mentions
  is gone, and the set is dropped from its own contents: the product page
  renders what is inside, and a set containing itself recurses.

### 2.4 Product routing and characteristics
- **Products:**
  - **Routing (SEO slug):** `Product` carries a `slug` (`String @unique`). A manager types it **in English, by hand** (`lipstick`, for example); it is not generated by transliteration.
    One address per product, with no parameters: `/catalog/[slug]` replaced
    `/catalog/[id]` with codes like `vsl-001`, and `?shade=` / `?volume=`
    existed only while variants did. Transliteration is refused because it
    would produce `balzam-dlya-hub`, which nobody searches for.
- **Flexible characteristics (EAV through JSONB):**
  - Per-product parameters (SPF, hold) live in `specifications`, of type `Json`.
  - The format is strictly an array of objects, `[{ "key": "Volume", "value": "10 ml" }]`, so the order is preserved.

### 2.5 Soft delete, and what is deleted outright
- **Soft delete, for products.** `isDeleted: Boolean`, and every public query
  filters on `where: { isDeleted: false }`. The reason is specific: an order line
  points at the product it was bought as, and erasing that would leave a paid
  order with no name and no price. There is one exception, `deleteProductForever`,
  and only while **nothing** points at the row.
- **Banners are deleted outright, and that is not an oversight.** `Banner` has no
  `isDeleted`: no order references a banner, it is not a financial record, and a
  finished campaign is not history anyone reads. The files are removed from
  storage when it goes (§6).
- **An order line freezes the name and the price, and reads the photograph
  live.** The money rests on the name and the figure that were charged, so both
  are copied onto the line and never change again. A photograph is not a fact
  the money rests on, so the line renders the product's **current** media
  instead. That is what makes it safe to delete a replaced file from the bucket
  at all (§6.5): no order is left showing a blank. `OrderItem.image` still
  records what was shown at the time and is deliberately not read.

### 2.6 Money is whole hryvnia
- **Money is whole hryvnia.**
  `price`, `promotionalPrice` and `total` are `Int`, in hryvnia. The range has no
  kopecks and will not have any, so there are no fractions to drift. A sum is
  converted to kopecks in exactly one place, `toKopecks`, at the Monobank
  boundary.
- **`price` is the ordinary price, and stops being the figure charged the moment
  a promotion is set.** Nothing may read `product.price` to decide money;
  everything goes through `chargedPrice()`, and exactly two places decide it:
  `createOrder` freezes what it returns onto the order line, and `cartLinePrice`
  shows it. The struck-through figure is `regularPrice()`, `undefined` while no
  promotion runs, because drawing one price twice would invent a discount of
  zero.
- **Turnover is `orderNetTotal`, never `order.total`.** `total` is what the
  customer was charged and does not change, which is the whole reason an order
  line is frozen; what a return gives back is subtracted at read time instead.
  Editing the charge would destroy the only record of what was actually taken.

### 2.7 The audit log
- **Audit log:** the `audit_log` table (`AuditLog`) records every critical change
  made in the panel, who made it and when, plus sign-ins, failed sign-ins and
  payment anomalies. A table rather than a file: on serverless the filesystem is
  read-only, so a file-backed journal writes nothing at all in production.
  **An owner reads everything; a manager reads only order and money events**
  (`MANAGER_VISIBLE_AUDIT_ACTIONS`), with IP addresses withheld. The journal
  records what managers did, so full access stays with the owner. A manager
  working an order still has a legitimate question, "what happened to this
  money", and the journal is the only place that answers it. The narrowing
  happens **in the query**, never by hiding a column: a filter applied after
  pagination returns short pages and gives the count away.
- **A condition that persists is recorded once, not once per check.**
  `logAuditThrottled` exists for states rather than events: an expired Nova
  Poshta key is still expired at the next scheduled probe, and an unthrottled
  job writes that line every run until it buries everything worth reading. The
  window is the caller's to choose, and it is a window rather than a flag so
  that a condition which clears and returns is recorded again.
- **`CRITICAL_AUDIT_ACTIONS` is what the journal draws as a warning**, and the
  test for membership is not severity but whether the entry resolves on its own.
  A payment mismatch, a payment after cancellation, money for an unknown order
  and an unreachable delivery directory all wait for a person; everything else
  in the log is a record of something already finished.
- **A customer's IP address is never written to the journal.** The log is a
  record of staff actions, and an employee's address in a security journal is
  ordinary; a shopper's would mean `audit_log` held personal data indefinitely,
  which then needs a retention period, a clause in the privacy policy and a job
  to enforce both. It buys little in return: the abuse worth investigating,
  somebody scripting create-then-release to hold stock, cannot be traced from it
  anyway, because order creation is not audited at all, so the releases would be
  visible and the creations invisible. What bounds that abuse is the
  `order-release` rate limit, whose counter lives in Upstash and expires on its
  own.
- **An OWNER may delete a single entry, and never `AUDIT_ENTRY_DELETED`.** The
  trail can therefore be thinned but not silently emptied: every deletion writes
  one of those rows, and those rows cannot themselves be deleted, so "something
  was removed here, by whom and when" outlives every removal. Without that guard
  the log could be reduced to a state indistinguishable from one nothing was
  ever written to, and no later reader could tell the difference. There is
  deliberately no bulk or date-range variant, a sweep being exactly what turns
  thinning into emptying. `requireOwner()`, never `requireAdmin()`, because the
  log records what managers did.

---
## 3. Security, limits and protection

### 3.1 Payments and card data
- **A customer's card never reaches our server.** Payment happens entirely through Monobank Acquiring's hosted checkout. Our backend receives a transaction token and id, never a card number, a CVV or an expiry date. That keeps PCI DSS and CVV brute-force protection where they belong, with Monobank as the certified acquirer.
- **Exactly one caller writes `PAID`, `applyPayment`, with no exception beside it.** There are two sources and both are server-obtained: a webhook carrying a valid `X-Sign`, and Monobank's answer to a request this server made with its own merchant token (the expiry sweep asks the bank before cancelling an order that has an invoice). Never the fact of a customer being redirected: a URL can be typed by hand.
  - Confirming a payment by hand (`confirmPaymentByHand`) has been **removed**.
    The shop accounts for money that moved **through the shop**, and an order
    marked paid on a staff member's word is by definition not that.
- **The checks before the write, in order:** the `X-Sign` signature → a status of
  exactly `success` → the order exists → it is neither cancelled nor returned →
  **the amount matches the server's own total** → the currency is `980` → the
  `invoiceId` is the one we created. Then a conditional
  `UPDATE ... WHERE status = 'PENDING_PAYMENT'`, so idempotency is the database's
  guarantee rather than the code's.
- **One payable invoice per order.** A new attempt voids the previous invoice and
  **refuses to create a replacement if the void failed**: two live payment pages
  mean a callback arriving with an `invoiceId` we are not expecting, which is
  money taken against an order that still reads unpaid. Setting the new invoice
  is a compare-and-swap, because two simultaneous calls would otherwise both go
  through.
- **Webhook idempotency:** if the order is already `PAID`, a repeated webhook is ignored (200 OK, no reprocessing).
- **Carding (testing stolen cards with small amounts through our checkout):** rate limiting on the payment route (below), a cap on payment attempts per order, and Sentry monitoring for an abnormal number of failed transactions from one IP or session.

- **[done] `APP_URL` comes from configuration, not from request headers.** That
  value builds the `webHookUrl` and `redirectUrl` sent to Monobank, and a spoofed
  `Origin` must not be able to redirect payment callbacks to another host.
- **[done] A cap on payment attempts per order** (`MAX_PAYMENT_ATTEMPTS = 5`),
  making the carding requirement of §3.1 concrete.
- **[done] The payment outcome is decided by the server, not by the address bar.**
  `/checkout/success` is a server component; `resolvePaymentOutcome` verifies the
  payment token, reads the order and asks the bank when it needs to. There is no
  `state` parameter in the URL any more. Without a valid token the page asserts
  nothing. A forged outcome would deceive only the person typing it, since a
  manager ships from the database, but what it produces is a screenshot reading
  «The payment went through» and an argument for whoever answers the messages.
- **[done] Order detail has no public endpoint.** The thank-you page shows a
  summary from `sessionStorage`, and `GET /api/orders/[id]` is admin-only. Order
  numbers are short and can be enumerated. The payment token sits in the same
  place, so a payment can be retried from that screen. That is not a weakening:
  the browser was given the token at checkout, it travels to Monobank in
  `redirectUrl`, lives 20 minutes and permits exactly one thing, opening the
  payment page for that order. The alternative, issuing a token on demand against
  an order number, is the enumeration hole the token exists to close.
- **[done] The webhook checks the amount, the currency and the `invoiceId`.** A
  valid `X-Sign` proves only where the message came from. `verifyPaidCallback`
  compares `amount` against the server's own total, `ccy` against 980 and
  `invoiceId` against the one we issued. A mismatch, and a payment for an order
  already cancelled, are written to the audit log (`PAYMENT_MISMATCH`,
  `PAYMENT_AFTER_CANCEL`) and answered with 200: Monobank retries anything that
  is not 2xx, and a retry cannot fix a mismatch.
- **Monobank guarantees no ordering between callbacks**, so `success` may arrive
  before `processing`. That costs nothing as long as `success` stays the only
  status that moves an order and `markOrderPaid` stays conditional: a straggler
  for an order already paid is then a no-op rather than a rollback. A handler
  that started acting on `processing`, or a write that stopped being
  conditional, would turn the ordering into a real problem.
- **`/api/monobank/return` decides nothing and must not be deleted.**
  `redirectUrl` is baked into an invoice when it is created, so invoices already
  open in somebody's tab keep arriving at whatever address they were issued
  with, for as long as they are payable. New invoices point straight at
  `/checkout/success`; this route forwards the order id and the token there
  unchanged, and removing it strands every shopper mid-payment at the moment of
  the deploy.
- **[done] Invoice creation is tied to placing the order.** `paymentToken` (an
  HMAC over the order id, TTL `PENDING_PAYMENT_TTL_MINUTES`, so 30 minutes, the
  same as the order itself, see §4) is returned by `POST /api/orders` and
  verified **before** an attempt is spent. Otherwise knowing a short order number
  would let anyone exhaust all five attempts and lock the real buyer out of
  paying for good. It is not authentication; checkout stays anonymous.
- **[done] The webhook signing key is cached, and one failure buys one
  refetch.** Monobank rotates the key, so a cache that expired only on time
  would reject every genuine callback until it did. The retry is deliberately
  narrow, because the ordinary cause of a bad signature is forgery, not
  rotation: only when the key came from cache, and at most once a minute per
  instance. Without that ceiling anyone posting garbage makes the shop call
  Monobank once per request until the acquirer rate-limits it.
- **[done] "Try paying again" is offered on `failed` and on no other
  outcome.** A retry begins by voiding the previous invoice, so offering it
  while the bank is still deciding, or while it could not be asked at all, risks
  killing a payment that was about to succeed. `processing`, `hold` and no
  answer therefore all resolve to the same screen, which claims nothing and
  offers nothing. `created` goes the other way and counts as failed: the shopper
  opened the bank's page and left, nothing is in flight, and letting it fall
  through to the thank-you screen would congratulate somebody on a purchase they
  did not make.
- **[done] `PAYMENT_TOKEN_SECRET` signs that token and nothing else.** It guards
  no session and no password, Supabase Auth owning credentials (§3.4); what it
  stops is the case above, and the name says so: this is not a key to the
  panel, and losing it signs nobody out. Unset in production it throws rather
  than falling back, and the development fallback is a per-process random value,
  so nothing signed before a restart verifies after one.
- **[done] Work that must happen once per payment sits behind the conditional
  update, never behind the webhook.** `markOrderPaid` is what moves the status
  off `PENDING_PAYMENT`, and only the caller that won that update gets an order
  back; the confirmation email, the Telegram notice and the `ORDER_PAID` entry
  all hang off it. At the level of "a callback arrived" a retry is
  indistinguishable from the original, and the customer gets an email per retry.
  Neither notice may throw: both report and swallow, so a mail provider being
  down cannot turn a settled payment into a callback Monobank keeps retrying.
- **[done] Secrets are compared in constant time.** Every such comparison in the
  shop checks a secret against something the caller chose, and `===` returns as
  soon as two characters differ, which leaks how much of it was guessed.

### 3.2 Rate limiting (Upstash Redis)
- Request limits on sensitive routes: checkout, admin sign-in (no more than 5 attempts a minute), the payment form. Protection against brute force and application-level DDoS.
- **CAPTCHA was considered and rejected, see §12.5.**
- **How the checkout limit is sized, and why it is not smaller.** The window is
  the reservation window rather than a minute, because every order reserves
  stock for half an hour: ten a minute would let one address hold three hundred
  orders' worth of goods without paying for any of them. The figure is thirty,
  not ten, because the key is an IP and Ukrainian mobile networks put thousands
  of subscribers behind one, as does any office. At ten, the eleventh shopper on
  a carrier's subnet met «try again in 30 minutes» on a perfectly honest first
  attempt, and nobody in the shop would ever learn it: a 429 is answered at the
  edge and never reaches `audit_log`. The cost of a wrong refusal is a sale
  nobody hears about, the same asymmetry §12.4 weighed when it refused a
  whitelist of telephone prefixes. It is also not the only bound:
  `MAX_ACTIVE_UNPAID_ORDERS` holds three per telephone number inside the
  transaction, which is the more precise of the two.
- **The delivery limit guards a local query, not a shared API budget.** The
  directory lives in our own tables and only the sync spends Nova Poshta's
  per-key budget, so this must not be sized as though every shopper shared one
  key. Entering an address costs five to eight requests (the city, debounced,
  then the branch), which leaves room for roughly forty shoppers on one
  carrier's subnet filling in an address in the same minute.

- **[done] Rate limiting no longer fails open.** The local and distributed
  counters are both always evaluated and the result is an `OR`. Before that an
  Upstash failure (or a typo in the URL) removed the limit completely on
  serverless, because nothing else was counting.
- **[done] Sign-in has three windows, not one.** By IP: 5 a minute
  (`proxy.ts`). By **account**, on top of that: 5 per 15 minutes and 20 per day
  (`login/route.ts`). An IP-only limit does not stop an attacker spreading
  guesses across many addresses, and a single short window does not stop a slow
  grind that stays under it. **Only failed attempts move the counter, and a
  successful sign-in clears it**, or twenty sign-ins in a day would lock the
  owner out of her own shop.
- **[done] The client address is never read from `x-forwarded-for` directly**
  (`src/lib/clientIp.ts`). That header is a client-supplied list which proxies
  append to, so its first entry is whatever the caller chose to send: reading it
  lets an attacker present a new identity per request and walk through any
  per-IP limit. The platform headers are read first, because the edge sets those
  from the real connection and strips an incoming copy, and `x-forwarded-for` is
  the last resort for a host that sets nothing else. Every rate limit and every
  audit entry is keyed through it.

### 3.3 Protection against DDoS and overload
- Edge protection in front of the application (Vercel Edge Network / Cloudflare) as the first line, alongside application-level rate limiting.
- The rate limiting from 3.2 as the second line, inside route handlers and server actions.
- **[done] Every call to a third party carries a timeout.** A request without
  one is unbounded rather than patient: Node's `fetch` waits minutes, and on
  serverless a waiting request holds the function and whatever Postgres
  connection it took, so a slow acquirer or carrier drains the pool instead of
  slowing one checkout. The waits are not equal, because the calls are not worth
  the same: reading an invoice status happens while a shopper sits on a
  redirect, creating one costs the customer their order if it fails, and voiding
  one runs unattended in a loop where hanging costs most and the answer matters
  least.

### 3.4 Protecting the admin panel
- Strict session authentication, not a password check on the client: the session is verified on the server for every protected `/app/admin/` route.
- **2FA is mandatory** for manager and administrator accounts. Compromising the panel means compromising the whole price list, and potentially XSS through `description` (see section 2).
- Rate limiting on admin sign-in (3.2), and failed attempts recorded in the audit log.

- **[done] Role and activity are read from the database, not from the token.**
  The session cookie carries only a `userId`, an issue time and a signature.
  Deactivating an account takes effect immediately rather than at token expiry.
- **[done] Authentication runs on Supabase Auth.** The hand-written
  implementation (`session.ts`, scrypt, `data/users.json`) is gone; passwords,
  resets and MFA belong to Supabase. The `anon` key stays server-side: the login
  form posts to `/api/auth/login` and `signInWithPassword` runs there, so no
  `NEXT_PUBLIC_` variable ever appeared (§1).
- **[done] Supabase session cookies are hardened in one place**
  (`src/lib/sessionCookie.ts`). `@supabase/ssr` supplies its own options with
  every cookie, and among them is `httpOnly: false`, which leaves the access and
  refresh tokens readable by any script on the page. That is sensible for the
  usual Supabase arrangement, where a browser client reads the session out of the
  cookie; here there is no browser client at all (§1), so `httpOnly` costs
  nothing.

  It is defence in depth rather than a patch for a live hole: React escapes
  everything and `dangerouslySetInnerHTML` appears nowhere. But the CSP still
  allows `'unsafe-inline'` for scripts, and the day an injection does appear,
  this is the difference between a broken page and a stolen admin session.
- **[done] Role and activity are read from `app_users` on every request**, never
  from the JWT. Verified: changing `isActive` in the database removes access
  immediately, with the session cookie unchanged.
- **[done] There is no registration in the application.** The first owner is
  created by a one-off script, `npm run create-owner`, which refuses to run once
  an active owner exists; after that the owner adds the team from the panel.
- **Creating a staff account writes two stores, and a half-written account is
  worse than none.** The Supabase Auth credential is created first and the
  `app_users` row second; if the second fails, the first is deleted again before
  the request returns. Without that rollback an address can sign in and resolve
  to no profile, which `getSessionUser` answers with `null` on every request:
  a login that succeeds and reaches nothing. Accounts are created confirmed,
  because an owner adding a colleague is the confirmation.
- **[done] A staff account's sign-in address lives in two stores, and they must
  not drift.** Supabase Auth owns the credential and decides what may sign in;
  `app_users.email` is what the panel shows and what audit entries resolve
  against. Change one alone and the account signs in under an address the shop
  does not recognise, or the reverse. `npm run update-account` writes both, and
  is a script rather than a button because the Auth side needs the service-role
  key. The display name is only in `app_users`, but it rides in the same tool:
  the journal prints it beside every action, so an account named for a role
  rather than a person is readable while one person uses the shop and wrong the
  moment two do. Renaming repairs past entries as well, because `actorName`
  comes from a join rather than a copy.
- **[done] The `/admin` corridor and the `aal2` requirement are two defences,
  and only one of them covers the API.** `proxy.ts` sends anyone without a
  verified factor to `/admin/security` and lets them reach nothing else, but
  that corridor matches `/admin` pages and not `/api/*`. So `getSessionUser`
  refuses on both counts, a missing factor as well as a session that stopped at
  the password. Drop either and a manager who ignored the enrolment screen keeps
  full API access, where `GET /api/orders` answers with every customer's name,
  telephone and address.
- **[done] `SameSite=Lax` is what makes CSRF a non-problem here, and it is
  written out rather than inherited.** A form on somebody else's site may POST
  to `/api/products` all it likes: the browser declines to attach the session
  cookies to a cross-site POST, so the request arrives with no session and
  `requireAdmin()` refuses it. Every state-changing route in the shop is POST,
  PATCH, PUT or DELETE, so that covers all of them. Supabase and every current
  browser already default to `lax`, and it is stated anyway, because a defence
  this load-bearing should not rest on two other projects continuing to agree
  with us. Not `strict`: that withholds cookies on ordinary cross-site
  navigation, so a manager following a link into `/admin` from their mail would
  arrive signed out and read it as an expired session.
- **[done] Security headers** (`next.config.ts`): CSP, HSTS, `X-Frame-Options`,
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
  `script-src` still carries `'unsafe-inline'`, see §11.
- **[done] 2FA (TOTP).** The earlier description of it here
  was inaccurate: Supabase does own the cryptography, but "turning it on" turned
  out to be three parts rather than one. The code step at sign-in, the `aal2`
  requirement in `getSessionUser`, and the largest of them, the enrolment screen
  at `/admin/security`, without which the first two have nothing to act on.
- **[done] Authentication moved to an existing solution along with the database
  migration.** The hand-written implementation (`src/lib/session.ts`, since
  **deleted**, plus `src/lib/auth.ts`) had the foundations right: an httpOnly
  cookie with an HMAC signature, scrypt with a per-user salt, the role read from
  the database on every request. What it did not have was 2FA, session
  revocation, password reset and email confirmation, each of which is its own
  project with its own traps.

  **Supabase Auth** was chosen because the database and file storage were moving
  there anyway (§2, §6), and authentication arrives with 2FA, password reset and
  session revocation attached. The vendor-neutral alternatives were Better Auth
  and Auth.js with a Prisma adapter. (Lucia was not considered: the author wound
  the project down.)

### 3.5 Zero trust (server-side pricing)
- A basket total from the frontend cannot be trusted. The server takes product ids, reads current prices from the database, and computes the amount itself.

### 3.6 Masking PII
- Card numbers, passwords and addresses never appear in error reports (Sentry). Consent to process personal data is mandatory at checkout.

- **[done] Consent to process personal data is mandatory**: a separate `consent`
  field in the checkout schema, without which no order is created (§3.6). The
  server stamps `consentAt` and the policy version the order was placed under;
  the client only asserts the checkbox.
- **Changing the policy text means bumping `PRIVACY_POLICY_VERSION` in the same
  commit.** The constant lives beside the wording in `storeContent.ts` for
  exactly that reason. Every order records the version it agreed to, and that
  record is worth nothing if the text can move under a version that does not.
- **[done] An extended audit log**: successful and failed sign-ins, sign-out,
  product CRUD, order changes, team management, confirmed payments.
- **[done] Sentry with PII masking.** See §9 for what
  it reports and what it strips.

### 3.6.1 Retention: erased, not deleted

Two laws pull in opposite directions. Tax rules want the transaction kept as a
primary document; data-protection rules want the person not kept beyond need.
Removing the person while keeping the sale answers both, and it also leaves the
shop's own turnover for past years intact, which deleting the row would not.

The clock runs from `createdAt`, and the privacy policy says so. "From
fulfilment" is the more precise idea and the one this cannot implement: no
column records when an order was fulfilled. Against three years the difference
is days, and creation is the earlier of the two, so the clock errs towards
holding personal data for less time rather than more.

`cityRef`, `branchRef`, `city` and `branch` stay. A branch is a public counter,
and with no name or telephone beside it «Kyiv, branch no. 12» identifies
nobody. What goes is everything that names a person or reaches their door.

### 3.7 Double-submit protection
- Buttons lock (`isLoading`) after the first click, so an order or a payment cannot be duplicated.

---

## 4. Basket, checkout and order management (OMS)
### 4.1 Order lifecycle
`PENDING_PAYMENT` ➔ `PAID` ➔ `SHIPPED` ➔ `DELIVERED` ➔ `CANCELLED` ➔ `RETURNED`.

- **Permitted transitions are one table shared by the server and the panel**
  (`ORDER_TRANSITIONS` in `types.ts`), and `PAID` appears in no column of it.
  `PENDING_PAYMENT → SHIPPED` is not permitted either: one mis-click there ships
  goods against an unpaid order and, at the same time, prints «The payment went
  through» for the customer, because the confirmation screen reads any status
  past `PENDING_PAYMENT` as proof of payment.

### 4.2 Creating an order and reserving stock
- **No merchant token, no orders.** The checkout used to accept orders without
  `MONOBANK_API_TOKEN`, because Monobank will not issue a token without seeing a
  shop that takes orders. The token exists now, so the reason is gone, and with
  it went the whole second life of an order: no invoice, no bank, a confirmation
  screen that congratulated the buyer, and a hand-written route to `PAID`.
  `POST /api/orders` answers 503 and the checkout says so before anyone types.
  An unset token in production is a deployment error, and refusing loudly is the
  right answer to one.
- **The order is written before the payment:** it goes into the database as `PENDING_PAYMENT` **before** the redirect to Monobank, with its prices frozen.
- **Atomic transactions (race conditions):** pressing "Place the order" decrements
  `stock` inside a transaction with `stock >= quantity` in the WHERE clause, so
  checking and decrementing are one statement. If somebody bought the last one a
  second earlier, the update matches nothing and the order fails. The condition
  is the quantity asked for, not `> 0`: the latter would let a basket of five
  through against one unit in stock.
### 4.3 One basket, one order
- **The same basket, from the same phone, while the previous order can still be
  paid, is one purchase.** A double click, a retry, a second tab or the back
  button would otherwise each mint an order reserving its own stock;
  `createOrder` answers with the order that already exists. A *changed* basket
  falls through to a new order deliberately, because adjusting a live
  reservation by the difference is a much larger job and nothing has needed it.

  The check runs **twice**, and that is the whole of the guarantee: once before
  the transaction for the common case, and once inside it under
  `pg_advisory_xact_lock`, keyed on the phone and the basket. Looking and
  writing are two steps, and two requests arriving together both look before
  either writes; the lock is what removes the gap. Transaction-scoped rather
  than session-scoped, because the app runs on the transaction pooler where a
  session-scoped lock leaks across pooled connections.

  **Do not replace it with `UNIQUE (phone, cartFingerprint) WHERE status =
  'PENDING_PAYMENT'`.** A partial index cannot express "and not expired", since
  `now()` is not immutable, so it would refuse a legitimate re-order while a
  lapsed unpaid one waits for the sweep. It would also give `P2002` a second
  meaning, where the order-id retry reads it as one.

  The fingerprint covers ids and quantities, sorted so the same basket in a
  different order hashes the same, and deliberately not prices: a promotion
  starting between two clicks would otherwise turn a double submission into two
  orders.
- **One phone may hold only so many unpaid orders at once**
  (`MAX_ACTIVE_UNPAID_ORDERS`). Each reserves stock for the length of the
  payment window, so without a bound a loop could hold the whole catalogue in
  «out of stock» without paying for anything. It is one of two bounds and
  neither is enough alone: a fresh phone number walks past this one but not past
  the per-IP checkout limit (§3.2), and a fresh address walks past that one but
  not this.
### 4.4 The reservation and its expiry
- **The sweep leaves alone what the bank has not finished with.** `processing`,
  `hold` and **no answer at all** leave the order standing until the next run.
  Otherwise a shopper confirming a card in the twenty-ninth minute of a
  thirty-minute reservation would find the order cancelled, and the webhook
  would arrive for something that no longer exists: money taken, goods back on
  the shelf.
- **[done] Automatic cancellation.** Stock is reserved when the order is created,
  before the payment page, and that is what stops two shoppers buying the last
  unit while one of them types a card number. The price of it is that an
  abandoned checkout holds goods, so `/api/cron/expire-orders` hands them back
  after `PENDING_PAYMENT_TTL_MINUTES`. The route is guarded by `CRON_SECRET` and
  scheduled in `vercel.json`. It has to run noticeably more often than
  `PENDING_PAYMENT_TTL_MINUTES`, or an abandoned basket holds its goods until the
  next run. **The schedule is `*/10 * * * *`**; the Hobby plan allowed nothing
  more frequent than daily, so before the move to Vercel Pro thirty minutes
  meant up to a day in practice. The schedule depends on the plan: going back to
  Hobby makes it daily again, and the deployment fails outright rather than
  degrading, which is worth knowing because the fix reached for under that error
  is to widen the schedule.

  **A slow sweep costs the buyer, not only the shelf.** The payment token
  expires with `PENDING_PAYMENT_TTL_MINUTES`, so an order left standing past it
  can neither be paid (`create-invoice` answers 403) nor handed back
  (`/api/orders/release` answers 403), and `/checkout/success` reports
  `unknown` while the stock stays reserved. Nothing in the panel shows it: the
  order looks alive and the goods look sold.
- **A run is bounded twice, by a batch and by a deadline.** The batch
  (`EXPIRY_BATCH_SIZE`) caps how many orders one run looks at; it cannot cap how
  long each takes, because each is a request to Monobank, and an unreachable
  bank makes every order cost the full timeout. So the route also passes a
  deadline, past which the loop stops and says so rather than being killed
  part-way: from outside those two look identical, and only one leaves a record.

  One consequence worth knowing: an order the bank is still deciding about is
  left standing and read again next run, so a batch's worth of simultaneously
  unresolvable orders would starve the ones behind them. That state is a
  Monobank outage rather than a backlog, and every run reports `waiting`
  precisely so it is visible when it happens.
- **The sweep and the release route both stand down without
  `MONOBANK_API_TOKEN`.** The checkout refuses orders in that state (§4.7), so
  there should be nothing for either to act on, and the guards are belt and
  braces rather than a mode. They stay because the dangerous case is a token
  removed **after** orders exist: without them the next scheduled run would
  cancel every order still on the books, and the release route would undo
  purchases nobody could have paid for.
- **One root constant, two derivatives.** `PAYMENT_WINDOW_MINUTES` (20 min) sets
  exactly one thing, the lifetime of the Monobank invoice.
  `PENDING_PAYMENT_TTL_MINUTES` (that plus 10, so 30 min) sets three: the
  reservation window (`expiresAt`), the payment token's TTL, and the checkout
  rate-limit window in `proxy.ts`. The reservation must outlast the invoice:
  releasing goods while the buyer is still on the payment page means taking money
  for a cancelled order.
### 4.5 Cancelling, and what goes back to stock
- **Two writers put stock back, and they lock the same rows.** `cancelOrder`
  and `setItemReturn` are the only functions that credit stock, and the status
  guard cannot separate them, because `setItemReturn` does not change the
  status. The interleaving that costs real goods:

  1. `cancelOrder` reads a line: quantity 2, `restockedQuantity` 0, so it owes 2;
  2. `setItemReturn` sets `restockedQuantity` to 2, credits 2 to stock, commits;
  3. `cancelOrder` credits 2 more and commits.

  Four units credited for two. Both take `FOR UPDATE` on the order's lines
  **before reading them**, so whoever arrives second waits, reads what the first
  committed, finds nothing owed and skips the line. Locking after the read
  closes nothing. There is no deadlock between them: `setItemReturn` locks a
  single line and takes nothing afterwards.
- **Coming back from the bank unpaid undoes the order; it is never edited.**
  `POST /api/orders/release` voids the invoice, returns the goods to the shelf
  and hands the lines back for the basket. An order is a frozen document and the
  invoice was built from it, so editing one would mean re-freezing prices,
  moving the reservation by a difference and reissuing the invoice, where
  undoing costs one conditional update that already exists.

  **The bank is asked before anything is undone, and that is the whole safety of
  it.** `cancelOrder` is conditional on `PENDING_PAYMENT`, which covers an order
  the webhook has already settled but not the gap where the money reached
  Monobank and the callback has not landed: the status still reads
  `PENDING_PAYMENT` and cancelling would hand back goods somebody has just paid
  for. Anything the bank calls live (`success`, `processing`, `hold`) is
  refused, and the shopper is sent to finish paying instead. Void before
  restocking, never after.

  The payment token authorises it, for the reason it guards invoice creation
  (§3.1): without it a stranger who guessed an order number could cancel other
  people's purchases and empty their reservations back onto the shelf.
- **A failed payment does not release the reservation.** The customer has five
  attempts and most often simply reaches for another card. `failure` and
  `reversed` are recorded in the audit log (`PAYMENT_NOT_COMPLETED`) but leave
  stock alone; genuine abandonment is what the reservation window is for.
  Monobank sends **no webhook for `expired`**, so a lapsed invoice is never
  recorded that way and is found only by the sweep, through `expiresAt`.
- **Soft cancellation:** before a waybill exists a manager can cancel an order,
  and every unit **not already back** returns to the shelf. Not the full line
  quantity: a partial cancellation or return may have credited some of it
  already (`restockedQuantity`), so cancelling adds only the difference. Once the
  parcel has been collected, a return is handled by receiving it by hand.
- **Every path that takes an order out of the payable state voids its invoice.**
  A payment page can sit open in a tab long after the shop has moved on, and
  Monobank will happily settle it, so an order whose goods are already back on
  the shelf would be paid for. `voidInvoice` is therefore called by the expiry
  sweep, by `POST /api/orders/release`, by a manager cancelling from
  `PATCH /api/orders/[id]`, and by `create-invoice` before it issues a
  replacement. Adding a path that leaves an order unpayable without voiding
  re-opens that window silently, because nothing fails at the time.

  The cancellation paths ignore the returned boolean and `create-invoice` does
  not, and that asymmetry is deliberate: cancelling must not fail because the
  bank is unreachable, while issuing a second payment page beside a live first
  one is exactly the thing to refuse.
- **A shipped order cannot be cancelled.** `SHIPPED` leads only to `DELIVERED`
  and `RETURNED`: a parcel with a waybill is in a van, and crediting its goods
  would offer for sale what cannot be sent. Everything that really happens to a
  dispatched parcel, whether refused, uncollected or lost in the post, is
  `RETURNED`, which leaves stock alone; the manager credits the units line by
  line when it comes back. The prohibition is stated **twice**: in
  `ORDER_TRANSITIONS`, which draws the buttons, and in `cancelOrder`, which does
  the write.
### 4.6 Returns
- **Cancellation can be partial.** A customer asking to drop one item from a
  **paid** order no longer forces the whole thing to be cancelled.
  `canRecordReturn` allows `PAID`, and the same per-line mechanism serves two
  events: before dispatch it is "cancel this item" (the "back on the shelf" tick
  starts ticked, since nothing ever left the warehouse), and afterwards it is
  "record a return". Which of the two is decided by `goodsHaveLeft` in
  `types.ts`. The shop moves no money in either case.
- **A return is a pair of quantities on the line, never a status.**
  `OrderItem.returnedQuantity` records what came back and `restockedQuantity`
  how much of it went back on the shelf. That is what lets an order be paid,
  partly refunded and still delivered, which are three facts no single enum
  holds, and it is why «partly returned» is derived (`orderReturnState`)
  rather than stored: a stored copy can disagree with the quantities beside it.

  The two quantities are separate because the answers differ. A sealed jar can
  be sold again and an opened one cannot, and only the person holding it knows
  which, so crediting stock is opt-in per line and never defaulted. Neither
  `setItemReturn` nor `markOrderReturned` moves money; the owner refunds in
  Monobank's own cabinet.

  Stock moves by the **difference** between the new figure and the one already
  recorded, which is what makes the form idempotent and reversible: saving it
  twice moves nothing, correcting a return downwards takes a unit back off the
  shelf, and clearing the tick removes everything that line ever added.

  `markOrderReturned` writes those same quantities for every line rather than
  setting the status alone. The word by itself would leave the order counting
  its full value in the turnover while the per-line control beside it recorded
  properly, which is two mechanisms under one name and the one a manager
  reaches for first recording nothing. It credits no stock either, for the
  reason above.
### 4.7 Paying for the order
- **Payment for goods:** online in full (Monobank) and nothing else. Cash on delivery was removed from the checkout.
- **The payment token lives exactly as long as the order** (`PENDING_PAYMENT_TTL_MINUTES`,
  30 min). It used to match the invoice's validity (20 min), which left a dead
  zone between minute 20 and minute 30: the goods were still reserved and the
  order could still be paid for or handed back, while both buttons answered
  «the session has expired».
- **Payment for delivery:** the cost of delivery is **not part** of the order
  total and is settled by the recipient at the Nova Poshta branch. The shop
  neither **computes nor displays** it; the calculator was removed (§5) because
  it would be a figure the customer never actually pays us. The checkout says
  «at the carrier's own rates», with no amount.

---
## 5. Logistics (Nova Poshta API)
- **Currency:** payment is always in hryvnia, whatever the delivery address. Conversion for Ukrainians abroad is done by their card's issuing bank, so no price or currency localisation is needed.
- **There is no international delivery.** It was removed along with Ukrposhta and Meest (§12.1). The shop ships within Ukraine, by Nova Poshta, and nowhere else. This line once described Nova Poshta Global as an "MVP simplification with automation in phase 2"; neither is happening.
- **Storing addresses:** the database keeps the system identifiers `CityRef` and `WarehouseRef`. **Not as input for TTN generation**, which is not happening (§5.1.1), but as the unambiguous identity of a branch: they are what `verifyDeliveryTarget` uses to prove that the chosen branch exists and belongs to the chosen city.
- **Delivery cost is not calculated.** The recipient pays, settling with the
  carrier at the branch, so the shop neither computes nor displays the figure.
  The checkout carries the note «at Nova Poshta's rates». Along with the
  calculation went `NOVA_POSHTA_SENDER_CITY_REF`, the parcel weight estimate and
  the `/api/delivery/price` route.
- **No box matrix.** Its purpose was choosing a box in order to compute a cost;
  since the cost is not computed, the need went with it. If automatic TTN
  generation ever happens, Nova Poshta will want weight and dimensions, and the
  field returns to the model together with that work rather than ahead of it.

### 5.1 Access to the Nova Poshta API

- **The key is free.** Generate it in the business cabinet: Settings → Security →
  My API keys.
- **The address directory (`Address.getCities`, `Address.getWarehouses`) works
  with any key.** That is all the application uses today, so at the current
  volume **no contract with Nova Poshta is required**.
- **A contract is required for shipments, not for the directory.** Creating
  waybills (`InternetDocument.save`) on behalf of a business, non-cash
  settlement and volume discounts all require a contract naming an authorised
  representative. Nova Poshta issues keys to a **private person**, and the phone
  and email used at registration have to match the contract. So this blocks
  phase 2, not today.
- **The key expires and has to be renewed.** When it lapses `callNovaPoshta`
  returns `[]`, the checkout falls back to manual entry, and nobody finds out.
  So `/api/cron/expire-orders` additionally probes the directory and writes
  `NOVA_POSHTA_UNAVAILABLE` to the journal, at most once an hour.
- **The limit of roughly 100 requests a minute counts per key**, not per
  visitor, so one budget covers every shopper at once. Only the sync spends it
  now (§5.3). The cache in `novaposhta.ts` stays in front of whichever source
  answered, the local tables or the API: cities for 24 hours, branches for 6, up
  to 500 entries in the process's memory.
- **Parcel lockers come back from the same `getWarehouses`** as branches, so a
  search already includes them. When a waybill is created the branch type does
  matter, since a locker has limits on size and weight. One for phase 2: the
  checkout does not currently tell a branch from a locker, and for a TTN that
  will not be enough.

### 5.1.1 TTN generation: not doing it

The manager writes waybills in Nova Poshta's own cabinet. So a contract with
Nova Poshta (§5.1) is not needed at all, and `cityRef` / `branchRef` stay on the
order as an exact address for a person, not as input to `InternetDocument.save`.

That changes the price of §5.2 below: an order without a `cityRef` no longer
blocks anything.

### 5.2 Orders without a `cityRef`

**While the directory works, the address must come from the directory.** The
city is required for **both** delivery methods, the branch for delivery to a
branch. Editing a chosen name clears its `Ref`, so the name and the identifier
cannot drift apart, and an empty `Ref` means "this is not what Nova Poshta
called it". The payment button greys out and the field is highlighted.

**A `Ref` is checked for shape before anybody is asked.** Every `Ref` Nova
Poshta issues is a uuid, so anything else is refused with no request and no
dependence on the directory being reachable. That is not tidiness: handed
something that is not a uuid, the API answers `success: false, errors: ["Ref is
invalid"]`, which the client flattens into "the directory did not answer", and
that path deliberately accepts the order. The crudest forgery of all was
therefore the one getting through, by being wrong enough to make the directory
complain.

**When the directory does not work, the rule lifts.** Getting that right
mattered: `callNovaPoshta` returned `[]` in four different situations (no key,
an HTTP error, a rejected key, a failed request) without distinguishing any of
them from "no such town". Under a strict check that would mean **an expired key
stops sales completely**. The answer now carries an `available` flag, and both
sides rely on it: the form and `POST /api/orders`.

**The server does not trust the browser.** It queries the directory itself, and
**only when `cityRef` is missing**: an order that carries one has nothing left
to prove. That keeps the extra call to the rare case, since the Nova Poshta
limit counts per key and every shopper shares it.

The price of the fallback is that `cityRef` and `branchRef` stay empty (`cityRef
String @default("")` in the schema allows it).

That breaks nothing today, because waybills are written by hand anyway. But
**the moment waybills are generated automatically** it will need:

- a marker in the panel for an order with no valid `cityRef` / `branchRef`, and
  a filter on it, or a manager will be hunting for such orders one at a time;
- ~~the ability to fill them in from the order page with the same autocomplete
  the checkout uses~~ — **done** (§8): the "customer and delivery" card is
  editable until dispatch, city and branch through the same suggestions. What
  remains is the "no valid `Ref`" marker in the list and a filter on it;
- a decision about historical orders placed while no key was set.

Written down now, because at the moment TTN generation is connected this debt
surfaces as a surprise, and here it is already described.

### 5.3 The directory in our own database
- **The directory lives in our own database.** The tables are `np_cities`,
  `np_warehouses` and `np_sync`, filled hourly by `/api/cron/sync-novaposhta`
  (`npm run sync-novaposhta` stays for a first fill and a forced refresh). The
  reason is Nova Poshta's limit of roughly 100 requests a minute **per key**,
  shared by every shopper: it is exhausted by concurrency, which means it is
  exhausted exactly when the shop is busiest. Only the sync spends that budget
  now, and `verifyDeliveryTarget`, which ran before **every** order, became a
  local query. The sync writes on `DIRECT_URL`, the session pooler: bulk-loading
  tens of thousands of rows is not work the application's pooled connection
  should be doing.
  **The fallback is mandatory:** while the tables are empty every lookup takes
  the old path through the API, because an empty directory would otherwise read
  as "no such town" and §5.2 would turn into a refusal of every order in the
  country.
- **A refresh outlives a single function invocation.** The full branch list is
  around 180 MB across roughly 100 pages, and Nova Poshta cannot answer "what
  changed since this date", so a run does not reliably fit into one serverless
  invocation. Rows are therefore not deleted before insertion but **stamped with
  the run's own timestamp**: `np_sync.runStartedAt` and `nextPage` hold the
  position, the next invocation continues, and when the last page lands
  everything still carrying an older stamp is pruned. That is how a closed branch
  leaves the directory. `syncedAt` and `rowCount` describe only a **completed**
  run, so `isDirectoryReady` never sees the directory half-filled. The schedule
  is hourly while the work is daily: most invocations find a directory younger
  than a day and return without spending a request. A completed run writes
  `NOVA_POSHTA_SYNCED` to the journal, one line per entity rather than per
  invocation.

### 5.4 A Latin query reaches a Ukrainian directory

Nova Poshta holds settlement and street names in Ukrainian only, so "Kyiv"
matches nothing at all — not a wrong answer, an empty one, which the form reads
as "no such town" and answers by falling back to typing the address by hand.
`toDirectoryQuery` in `src/lib/translit.ts` converts a Latin query before it
reaches either tier; a query already in Cyrillic is returned untouched.

It reverses the national romanisation, and two rules carry most of the work.
**`i` after a vowel is «ї»**, which is the whole of "Kyiv" → «Київ» and
"Mykolaiv" → «Миколаїв». **A final `-sk` or `-tsk` restores the soft sign**
that sits before the last consonant, where a prefix match cannot recover it:
«Луцк» never finds «Луцьк».

A soft sign at the **end** of a name needs no rule, because the directory matches
on a prefix — «Тернопіл» still finds «Тернопіль». What needs a rule is the one in
the middle, and what cannot have one is listed by hand: «Львів» romanises with no
trace of its soft sign at all, and a shopper may still type a Russian spelling.

Reversing a romanisation is ambiguous, and the ambiguity is settled rather than
hidden. `iu` is «ю» in «Люботин» and «і»+«у» in «Маріуполь»; the iotated pair is
read as one letter only where it ends the word, which is where it is productive
(-ія, -ця, -жжя). «Маріуполь» is worth more than «Люботин», and the function is
pure and pinned by `npm run test`, so the trade is visible rather than folded
into a lookup nobody reads.

---
## 6. Media pipeline
### 6.1 What is accepted, and how it is checked
- **Client-side validation:** the browser measures a clip's duration before
  upload, which is a convenience rather than a control. The server independently
  checks the size and the **content**: images are re-encoded through sharp,
  which is what rejects anything that is not an image, video is matched against
  its container's magic bytes (`ftyp`, **MP4 only**), and the extension comes
  from those bytes. WebM and MOV were dropped: Safari plays WebM only partially
  while H.264 plays everywhere, so that is one source fewer and one check
  instead of three.

### 6.2 The limits
- **The limits, as they actually stand in the code:**

  | What | Value | Where | Why |
  |---|---|---|---|
  | Photo in | 4 MB | `MAX_IMAGE_BYTES` | Vercel's request body ceiling is about 4.5 MB, so anything larger never arrives |
  | Photo out | **2048 px**, WebP q100 | `OUTPUT_MAX_WIDTH`, `OUTPUT_QUALITY` | storage holds the **master**; Vercel serves the shopper a version sized for their screen, so neither the master's resolution nor its quality costs a visitor anything. 1600 was too tight: the gallery's main frame is about 700 CSS px, retina asks for 1400, and any crop ate the rest. Vercel's ceiling for the output file is 8192 px. Measured: q100 against q92 is 87% more bytes |
  | Video | 4 MB / 20 s | `MAX_VIDEO_BYTES`, `MAX_VIDEO_SECONDS` | about 1.6 Mbit/s. One number doing two jobs: half the egress, and small enough to pass the request body ceiling |
  | Clip poster | 800 px, WebP q75 | `POSTER_MAX_WIDTH`, `POSTER_QUALITY` | the browser fetches it **directly**, past the optimiser, so a master here would cost more than the metadata it replaces |

- **How hard the optimiser compresses, `IMAGE_QUALITY = 98`, is one number for
  every surface.** Three components with three settings would be three answers
  to a question nobody asked deliberately. Measured against the real files:

  | surface | q75 | q90 | q95 | q98 | q100 |
  |---|---|---|---|---|---|
  | banner column, desktop | 57KB | 112KB | 163KB | 207KB | 222KB |
  | banner, phone full width | 74KB | 143KB | 201KB | 246KB | 264KB |
  | gallery main frame | 18KB | 51KB | 111KB | 227KB | 239KB |
  | catalogue card | 4KB | 8KB | 12KB | 20KB | 20KB |
  | gallery thumbnail | 2KB | 4KB | 7KB | 9KB | 10KB |

  100 is deliberately not it: it buys 5 to 7% more bytes than 98 for a
  difference that does not survive a screen. What 98 does cost is the banner,
  the first thing painted on the home page, at 246KB on a phone against the
  143KB it was. If that ever needs winding back this is the one number to
  change, and 95 is the step that keeps most of the quality for 201KB. Every
  value used has to be listed in `images.qualities` in `next.config.ts`, because
  Next refuses a `quality` that is not there.
- **A clip's poster is a convention, not a column.** It is generated from the
  first frame at upload time and stored beside the clip under the same random
  stem, so the pair needs no second field on the product and no migration. A
  clip uploaded before this existed simply has none: the request 404s and the
  browser shows the empty frame it would have shown anyway.
- **`media` is the name, on the column, the input and the schema alike.**
  Photographs and clips share one ordered list, so a manager arranges them
  together and the first entry is the primary one either way. `images` belongs
  to `Banner` and to nothing else. Anything rendering product media has to ask
  `isVideoUrl()` before choosing between `<Image>` and `<video>`, and the
  storefront gallery and the admin editor must answer that the same way.

### 6.3 Why `sharp` stays
- **`sharp` stays, and it is not about file size.** It is three things at once:
  the only real check that a file is an image; the removal of EXIF (a phone
  photograph carries the GPS coordinates of where it was taken); and the
  flattening to 4:5, which the whole design is built on. Removing it for "better
  quality" is a mistake: quality comes from resolution, not from the codec.

### 6.4 A clip is never the primary item
- **A clip is never the primary item.** `media[0]` is drawn by the catalogue
  card, the basket line and the checkout summary, all three through `<Image>`, so
  a clip there would be a broken image on the shop's most visible screens. The
  gallery is the only place that asks `isVideoUrl` before choosing an element.

  **Two levels** hold that rule, and both are real: `productSchema` refuses with
  a readable message, and the uploader simply does not offer the "make primary"
  star on a clip, plus a warning if a clip ends up first after the photo before
  it was deleted.

  The description of this rule stood here long before the rule did: the spec
  claimed three levels of protection while the code had none. Recorded, because
  that is the most expensive kind of divergence: the next reader takes the
  question as settled and does not check.

- **Banners are photographs only.** `HeroBanners` draws every cell through
  `<Image>` and has no branch for video. `bannerSchema` refuses a clip, and the
  banner editor does not offer one in the file picker at all
  (`allowVideo={false}`), because refusing after the upload is too late. A clip
  in the hero is a separate design decision, and nobody made it.

### 6.5 Uploads go through our own route
- **Direct upload to Supabase Storage was considered and NOT done.** Everything,
  video included, goes through `/api/upload`, because that is where the only real
  validation lives: the sharp re-encode and the magic-byte check. A signed URL
  straight into the bucket is a path past both. Vercel's serverless body limit
  (about 4.5 MB) is real, and it is what makes the video ceiling a question of
  more than quality; if more is ever needed, that is the moment to revisit direct
  upload, validating the stored object instead.
- **Media the shop stops showing is deleted by the route, after the write, never
  by `db/`.** `updateProduct`, `updateBanner` and `deleteProductForever` report
  which URLs they orphaned and the handler removes them once the database has
  committed. The order is the whole point: a bucket that refuses must not undo a
  save the manager already watched succeed, so a storage failure costs an unused
  file and nothing else. Deleting at all is safe only because an order line
  reads the product's **current** photograph rather than a frozen URL (§2.5).
- **Cache on upload:** `cacheControl: 31536000`. File names are random and are
  never overwritten, and without this Supabase serves `max-age=3600` and Vercel's
  optimiser re-fetches the original every hour.
- **Dropped connections:** `try/catch` plus a "Try again" button, so the database does not end up with broken links.

### 6.6 No preview in the panel
- **There is no preview in the panel, and none is planned.**
  The editor does not show how a product will look on the storefront and has no
  "view on site" button: the product page is two clicks away, and a preview
  inside the panel is a second implementation of the same layout that drifts from
  the first every time the design changes. An uploaded file appears in its slot
  immediately, and that is enough.

---

## 7. Frontend, UI/UX and SEO
### 7.1 The catalogue and the product card
- **Product card (catalogue):**
  - A strict aspect ratio (`aspect-[4/5]`, `object-cover`) so the grid never breaks.
  - The "scroll down" button was dropped in favour of free scrolling.
  - Quantity buttons in the basket were made more compact.
- **"Complete your ritual" recommendations come from data, not from a flag.**
  The block used to show the first four products of an array, which meant the
  same set under every product. The rule is now:
  1. if this is a set, its own contents (`ProductComponent`);
  2. if the product belongs to sets, those sets;
  3. topped up to four from the same category.

  The `featured` field was **removed** with it. A boolean answers "which products
  are special in general", which suits a curated block on the home page that does
  not exist, rather than "what goes with this product". Flagged products would
  have appeared under every card, which is exactly the behaviour the rule fixes.
  If editorial control is ever needed, the right shape is a "product →
  recommended" relation, not a flag.
- **The catalogue loads whole, with no pagination.** "Load more" and infinite
  scroll solve the problem of thousands of items, which does not exist here: for
  an own-brand shop the catalogue **is** the collection, and people scroll
  through all of it. Pagination would break in-page search, make the counters
  beside the categories half-true, and add state. Card images are lazy already
  (none carries `priority`), so "all at once" is about data rather than traffic.
  Worth revisiting near 50 to 60 products, and the first step then is virtualising
  the grid rather than adding a button.
- **Search stays on the client.** The catalogue page with every product weighs
  about 130 KB, and filtering is already synchronised with the URL. Server-side
  search would mean a request per keystroke and a slower answer. The advice that
  "search should be server-side" applies to catalogues of hundreds of items; come
  back to it when there are more than about 100 products or when typo tolerance
  is wanted, and then it is Postgres full-text search rather than moving
  `.includes` to the server.
- **The catalogue's order is editorial, and the tie-break is not optional.**
  Products sort by `position` ascending, which is what a manager drags in
  `/admin/products`, and then by `createdAt` descending. Two rows sharing a
  position come back in whatever order Postgres finds convenient, which differs
  between page loads and gives a catalogue that shuffles itself; the second key
  is what stops it. That pair is also the order the shop had before `position`
  existed, so a list nobody has touched looks exactly as it did.

  The admin list is sorted the same way deliberately: the screen where the order
  is set has to be the order the customer sees. A new product is created at the
  **front**, because a novelty is the thing worth showing first and one drag
  moves it down when it is not, where pulling it up from the bottom is several.
- **The grid is rendered on the server, and the filter is applied afterwards.**
  `useSearchParams` reads the query string, and any component calling it takes
  its whole Suspense boundary out of the static render — which put the entire
  catalogue behind a loading line, leaving the server HTML with no product name,
  price or link in it. The filters now live in component state, seeded from the
  address bar through `useSyncExternalStore`, so the server can answer
  "everything" while the browser corrects it to what the link asked for. That
  correction lands within the same paint on a built deployment; in `next dev` it
  is visible, because the page is compiled on demand and hydration waits for it.

  The cost is that the first server render cannot know the category, so
  `/catalog?category=…` is answered by the unfiltered page and corrected in the
  browser. That address is the shareable form of a filter rather than a page of
  its own.

### 7.2 Forms and page loading
- **Forms:** names are capitalised automatically, and phone format is validated strictly.
- **Page loading:**
  - **Hero (home page):** the image carries `priority`. The brand logo animates as a preloader.
  - **Other pages:** `loading.tsx` skeletons that hold the exact dimensions, for zero layout shift (CLS).

- **[done] Skeletons exist** for the catalogue, a product, "About", the checkout
  and the panel.
### 7.3 SEO
- **SEO comes last.** The site has to work correctly and reliably first; search
  optimisation follows. Variant routing went away with the variants themselves
  (§2): a product's address is `/catalog/[slug]`, one per product, with
  `rel="canonical"` pointing at itself.
- **[done] `metadataBase`, canonical URLs and Open Graph** on product pages.
- **[done] `sitemap.ts` and `robots.ts`** through the App Router. `sitemap.ts`
  returns the static routes plus every published product.
- **[done] Structured data (JSON-LD)**, built in `src/lib/seo.ts`. A `Product`
  with an `Offer` is what puts the price and «in stock» under the search
  result itself; an `Organization` ties the name, logo and Instagram together
  for the panel beside a brand search; a `BreadcrumbList` gives the trail. The
  builders are pure functions over the values the page already rendered, so the
  markup cannot describe a product the page is not showing.
- **A `description` is not a ranking factor.** It decides whether the result is
  clicked, not where it sits, so it is written to read well rather than to carry
  search terms. Keywords belong in the title, the `h1` and the page's own text,
  which is where they count. Google prints its own excerpt from the page in
  place of the declared description often enough that treating this field as a
  lever is a mistake either way.
- **[done] `WebSite` beside `Organization`**, and an `ItemList` on the
  catalogue naming the order the page renders. No `potentialAction` search box:
  Google retired that result, so the markup would describe nothing.
- **The organisation carries its Cyrillic name too.** The shop writes itself
  `VELUR` everywhere, so the only Cyrillic spelling of the name on the site belongs to
  the founder and to the registered trader — a person, not the shop.
  `alternateName` is what says the two spellings are one organisation. It helps
  the entity resolve; it is not a substitute for the word appearing in visible
  text, which is where a Cyrillic search actually matches.
- **An `Offer` carries the return policy, and deliberately not the shipping.**
  `hasMerchantReturnPolicy` repeats the fourteen days the returns page already
  publishes, and `priceValidUntil` carries the horizon Google asks an offer to
  state — not a promise, since what is charged is resolved server-side at
  checkout (§3.5). `shippingDetails` is left out: Google wants a rate in it, and
  the shop has none to give — the recipient settles with the carrier at the
  branch (§5), so any figure here would be one nobody pays us.
- **The home page owns an `h1` that content cannot move.** The only heading used
  to be the hero slogan, which a manager rewrites whenever a campaign changes,
  so the page's strongest signal changed with the banner. The slogan is now a
  paragraph, styled exactly as before, and the heading is a `sr-only` line
  describing the shop.
- **`lastModified` in the sitemap is carried only where a timestamp is real.**
  Products and the two pages that change with them get `updatedAt`; the legal
  pages get nothing, because stamping them with today's date claims a revision
  that never happened.
- **Every category has an address of its own.** `/catalog/category/[slug]` is
  server-rendered and already filtered, which `/catalog?category=…` cannot be
  (§7.1), and it is what a search for a product kind can land on. The listing
  reads the cached catalogue and narrows it in memory, so a category costs no
  query; `revalidateCatalog()` drops these pages alongside the others, and a
  category added later is rendered on first request.

  **It wears the catalogue's toolbar, to the pixel.** The categories are laid
  out as links where the catalogue puts its dropdown, with «Collection» beside
  them and the current one filled black — a category page has no other way out
  of the category it is showing. The painted box is the toolbar's own 36px, and
  the 44px a tap target needs is transparent padding around it, so the rule is
  kept without the two screens showing two sizes of one control. The label is hidden below `tablet`, where it would
  take a quarter of the row from the controls; the strip scrolls sideways rather
  than wrapping, and `ScrollActiveIntoView` brings the current chip into view,
  since editorial order can leave it off the right edge.

  The visible heading went with it, so `h1` is the category name as a `sr-only`
  line: on screen the name is carried by the breadcrumb and by the filled chip,
  and a page whose strongest signal is «Collection» would say the same thing on
  all four.

  **The page carries no editorial copy, and that is a constraint rather than an
  omission.** `Category` holds a slug, a name and a position, so a sentence
  written here would be text on a live page that no manager can find in the
  panel — the mistake §12.4 exists to prevent. Heading and description are
  derived from the name the panel already owns. Per-category prose needs a field
  on the model and a box in the editor first.

  **The category list it reads is cached, and that is load-bearing.** A URL
  segment accepts any string, the route renders on demand, and `src/proxy.ts`
  does not match `/catalog/...`, so an unknown slug is a request anyone can
  repeat without limit. Read through the uncached `getCategories()`, each one
  would be a Postgres round trip on the pool the checkout shares.
  `getPublishedCategories()` is the storefront's copy, tagged like the catalogue
  and dropped by `revalidateCatalog()`; the panel keeps the uncached function,
  being behind a session and a rate limit.


### 7.4 Client state and the basket
- **The browser stores identifiers, never a product.** The basket persists
  `{productId, quantity}` and the wishlist `{productId}`; `ShopHydrator`
  exchanges them for current products through `POST /api/cart/resolve` on mount.
  A stored snapshot of a product goes stale the moment a manager edits a price,
  and the customer then agrees to one figure and is billed another.
- **The readers are deliberately more forgiving than the writers.** They ignore
  fields they do not recognise and merge duplicate lines, because this data sits
  in a shopper's browser for as long as they leave it there, across releases. A
  basket that survives a deployment is worth more than one that validates
  strictly and comes back empty.
- **A correction is shown, never made silently.** `/api/cart/resolve` reports
  what it changed, and `CartNotices` renders that in the drawer and at checkout:
  a basket that quietly halves a quantity is worse than one that explains
  itself. What a card cannot promise precisely, the checkout answers exactly
  («N pcs left»), because it reads through Prisma rather than the cached
  catalogue.
- **A correction that changes what is being bought has to be read before the
  shopper may pay.** `noticeBlocksCheckout` decides which ones do, and it is
  only those three: an item removed, sold out, or reduced in quantity. The
  submit button stays dead while one is unread, because a live button through an
  unread correction buys whatever the basket became rather than what the shopper
  agreed to. It is the promise that is being protected and not the money, since
  a correction can only remove or reduce and nobody is ever charged more than
  they saw. The two notices about a released order do not block: one restored
  the basket to what was already ordered and the other changed nothing.
- **One place decides a line's cost**, `cartLinePrice`. Reading `product.price`
  directly ignores a running promotion, and then the basket shows one figure
  while the order charges another (§3.5).
- Client state is one Redux Toolkit slice, `shopSlice`, holding the basket, the
  wishlist and the drawer and toast flags together, because every one of them is
  written by the same few interactions.

---

## 8. Admin panel (UX and architecture)
### 8.1 Roles and access
- **Roles and access (RBAC):** three roles. `OWNER` (the business owner, full
  access), `MANAGER` (added by the owner, limited rights) and `CUSTOMER` (a
  buyer; unused for now, reserved for future customer registration). **Only**
  `OWNER` and `MANAGER` reach `/admin` and the admin API, and the check runs
  against the explicit `ADMIN_ROLES` list rather than merely confirming a
  session. An `OWNER` can deactivate a `MANAGER` (`isActive: false`, a soft
  revoke rather than deleting the account, so the audit log keeps resolving to a
  real person). Protected server actions check the role on the server for every
  sensitive action, not just hide UI elements on the client.

### 8.2 How the panel is put together
- **Isolation:** the `/app/admin/` routes have their own independent `layout.tsx`.
- **Concurrency control (phase 2):** a version or timestamp check on save, to prevent conflicting parallel edits.
- **The panel has its own form primitives, and pages use them rather than
  restyling inputs.** `Card`, `Field`, `Select`, `Notice`, `PageHeader` and the
  `inputCls` family live in `src/app/admin/ui.tsx`. Nothing stops a page writing
  its own border and focus classes, which is exactly why the rule is written
  down: the editor and the dashboard had drifted apart that way, and a drift in
  form styling is invisible until the two screens are opened side by side.
- **What the panel shares with the storefront is behaviour, never input
  styling.** `Toast` and `Autocomplete` come from `src/components/ui/` because a
  dropdown and a notice behave the same wherever they are. The inputs do not
  travel: `TextField` is the storefront's, where a field is part of the brand,
  and `fieldCls` is the panel's, where a field is part of a tool. Reaching for
  the other set is how one screen ends up looking like the other half of the
  application.
- **A screen with unsaved edits asks before it is left.**
  `useUnsavedChangesGuard` covers both exits a manager actually takes: closing
  the tab, through `beforeunload`, and clicking an internal link, caught in the
  capture phase before the router navigates. The product editor, the banner
  editor and the catalogue reorder all use it, because each holds work that
  exists nowhere else until it is saved.
- **[done] Optimistic updates:** clicks in the panel (statuses, waybill, note) show immediately and roll back on error.

### 8.3 Content a manager edits
- **Why banners live in rows and the static pages do not.** A banner is the one
  piece of site content that genuinely moves, and a seasonal campaign must not
  be a developer task and a deploy. The legal and "about" pages are the opposite
  case: written once, an editor for them would be machinery without a user.
- **Block 04 is written per product, and there is no default anywhere.**
  `Product.packaging` is required, never substituted at render time and never
  pre-filled in the editor. Both shortcuts fail the same way: copy appears on a
  live page that the manager responsible for it cannot find in the panel to
  change. The constant that used to hold a default is gone, and reintroducing
  one under any name brings the failure back.
- **A change to a price or a stock figure is confirmed before it is saved.**
  `priceDiff` compares the form against the values the product was loaded with
  and names what moved, in words rather than field names. Only money and stock:
  a mistyped price sells at the wrong figure until somebody notices and a
  mistyped stock oversells, while a mistyped description is visibly wrong to the
  person who typed it.
- **[done] Categories are rows a manager creates and renames.** The Latin name
  is typed by hand under the same rule as a product's (§2.4), and it **is**
  editable, which now changes the category's own address (§7.3) rather than only
  a shared filter link: the previous `/catalog/category/…` starts answering 404,
  including for anyone arriving from a search result that still holds it. The
  form says so. Refusing the edit is worse, because a product's own address is
  editable on exactly those terms and a typo here would otherwise be permanent,
  curable only by making a second category and moving every product across.
  Nothing is orphaned by it: products point at the category by id, never by
  name. New categories go last, the order being editorial with no screen for it
  yet.
- **[done] Banner management.** `/admin/banners`: create, delete, enable and
  disable, reorder, upload photographs, write an eyebrow, a heading and up to
  two buttons. Three active at most. A banner photograph is **not** flattened to
  any ratio, unlike a product's (§6.3): the hero's cell is a different shape at
  every width, so the banner crops from the centre at render time and the editor
  shows that shape.
- **[done] A banner is exactly three photographs, and there is no other kind.**
  `bannerSchema` refuses fewer and says how many are missing. Three is what
  survives being narrowed: a third of a desktop hero is a tall portrait and a
  phone showing one photograph is a slightly taller one, so the same file works
  at both widths. Asking a manager to choose a layout first was the wrong
  question, because the answer changed the shape of every cell at every width at
  once. A narrower screen therefore shows **fewer photographs, not fewer
  banners**, and the ones that drop are the later ones, so the first photograph
  is the one every visitor sees. That is the single fact the editor asks a
  manager to hold on to.
- **[done] A banner button may only point into this shop.** One definition
  serves both buttons, because a security rule written out twice is one where a
  correction reaches a single copy. Relative addresses only: an absolute URL
  would let the shop's own hero send a shopper somewhere else, and a second
  leading slash is refused because `//evil.com` is protocol-relative and the
  browser leaves entirely. Dot segments are safe and allowed, resolving against
  this origin before the browser navigates. A label with no address is refused
  too, since it renders no button and reads as a broken one.

### 8.4 The order journal
- **[done] The order journal is read in pages.** `GET /api/orders` returns
  `{ orders, nextCursor }`: twenty cards and a cursor
  (`[createdAt desc, id desc]`), with a "Show more" button. **Every filter is a
  condition in the query, never a `filter` on the screen**: archived against
  live, period, status, search. The figures above the list and the counters in
  the menu are a separate `GET /api/orders/stats`, which counts the **shop rather
  than the page**: the archive split and the search box do not narrow it, the
  period does. Period boundaries are computed in `Europe/Kyiv` explicitly
  (`src/lib/orderPeriods.ts`), because the deployment runs in Dublin and without
  an explicit zone "today" would start two or three hours early. The cursor
  carries two keys rather than one because `createdAt` alone ties when the sweep
  cancels a batch inside a single second.
- **[done] Search looks in five columns and is deliberately unindexed.** The
  order number, the customer, the telephone, the email and the waybill, with the
  terms ANDed so «Petrenko 099» finds the order carrying both. A substring match
  cannot use a b-tree, and the alternative is a trigram index on five columns to
  serve a box used a few times a day. The term count is capped, or a pasted
  paragraph builds an OR per word across all five.
- **[done] Archiving is a view, and it is refused on an order that still owes
  work.** `archivedAt` is a timestamp, so "live" is `null`; the row is untouched
  and its money still counts in the turnover. Only `DELIVERED`, `CANCELLED` and
  `RETURNED` may be archived, because hiding an order waiting to be paid or
  packed files away the manager's own to-do list.

### 8.5 One order
- **[done] Order detail:** visual status badges, **editing the customer's
  details** (name, phone, email, city, branch or address, wishes) and a manager's
  internal note. Editing is available only while the order has not shipped: from
  `SHIPPED` the waybill is already written, and correcting our copy of the
  address would only make the two disagree. City and branch come from Nova
  Poshta's suggestions under the same rule as the checkout (editing the name
  clears the code), and the validation schema is shared with the checkout.
- **[done] An order can be flagged for a human, and the flag is not a status.**
  `needsReview` and `reviewNote` are raised by the payment anomalies (§3.1) and
  paint a warning on the order. They exist beside the audit log rather than
  instead of it, because only an OWNER reads the log while it is a MANAGER who
  works the orders, so without the flag the warning is invisible to the person
  holding the parcel. The note is additive: a second anomaly appends rather than
  replaces, since the earlier one usually explains the later. Nothing clears the
  flag automatically, a person does, and that resolution is appended too, since
  what went wrong is a financial record. An unresolved flag also refuses the
  deletion below.
- **[done] A cancelled order that no money reached can be deleted outright**
  (`deleteCancelledOrder`), the one exception to "orders are never deleted". The
  case it exists for is the ordinary one: an abandoned checkout leaves a
  cancelled row holding a stranger's name, telephone and address, and there is
  no reason to keep it. So an unpaid `invoiceId` does not block the deletion,
  since it describes almost every abandoned checkout, while two things do:
  `paidAt`, because a row recording money owed back to somebody is the last that
  may be destroyed, and `needsReview`, because deleting the order deletes the
  unanswered question with it.

  Lines cascade and stock needs nothing, `cancelOrder` having already credited
  it. The `ORDER_DELETED` audit entry outlives the row, because `audit_log.target`
  is text rather than a foreign key; it carries the totals and never the
  customer, since the usual reason to delete one of these is that it holds a
  stranger's telephone. The button lives on the order page alone, behind a
  destructive confirmation: a control that destroys a row does not belong in a
  list. There is deliberately no bulk or date-range variant.

---
## 9. Operational details and integrations (DevOps)

- **Fiscalisation (PRRO), phase 3 [backlog]:** integration with a PRRO provider (Checkbox, for instance) to issue receipts automatically after a successful Monobank webhook.
- **Customer delivery notices, phase 3 [backlog]:** SMS/Viber to customers about
  waybill status through the Nova Poshta API. The shop's own SMS channel (§9.2) is
  not a head start on this and does not cover it: it speaks once, about payment, and
  knows nothing about a waybill — nothing here reads one back (§5.1.1).
- **Database migrations:** the deployment rule is that `prisma migrate deploy` runs before the application code is deployed.
- **Database backups:** `npm run backup` (`scripts/backup.ts`) exports tables to local JSON backup archives.
- **Time zones:** the server and the database work strictly in UTC. Conversion to Kyiv time happens on the client (with the sole exception of the order number date stamp, §11).

---

### 9.1 The load ceiling

> A reference for the day this grows: where the limit is and which knob raises
> it. Optimising for load that does not exist costs more than raising a limit at
> the moment it actually runs out.

**What Supabase counts.** Four meters, three of which do not move here: storage
(about 150 MB of 1 GB), database size (38 MB of 500), MAU (customers do not
register), and **egress**, the only one that grows.

**Photographs and video behave differently, and that is the point.**
`next/image` is a Vercel proxy: the master is fetched from storage **once per
size** and served from Vercel's CDN afterwards. Next has no equivalent proxy for
video, so `<video src="…supabase.co/…">` pulls the file straight from storage on
every play. Supabase egress is therefore **almost entirely video**, which is why
a clip is capped at 4 MB (§6).

**What breaks first.** Neither connections nor compute:

1. **Video egress.** 5 GB on the free plan, which is roughly 7,000 visits a
   month. The knob is Supabase Pro (250 GB), and after that a separate video CDN.
2. **No backups.** The free plan has none at all, and no restore either. With
   real orders on the books that matters more than egress.
3. **Vercel traffic**, 1 TB on Pro, which is not a question.

**What is deliberately absent from that list is database connections.**
Storefront pages are cached and never touch the database; `POST /api/cart/resolve`
reads through `unstable_cache`, so it costs one query a minute regardless of how
many visitors there are. The `max: 5` limit per instance and the transaction
pooler are sized so that hundreds of concurrent readers do not occupy even one
connection (`src/lib/prisma.ts`).

The bound is **per instance**, which is the whole point of it. `pg.Pool`
defaults to ten and opens them lazily, and that reads as harmless until you
remember what an instance is here: Vercel starts a new one whenever traffic
needs it and each holds its own pool, so a busy hour is not one pool of ten but
twenty pools of ten against the same Supabase pooler. What breaks at that
ceiling is the wrong half of the shop, because the catalogue is cached and needs
no connection at all while `createOrder` and the panel do: an unbounded pool
fails as a shop that serves its crowd perfectly and stops taking their money.
Five rather than ten and rather than one, because an instance genuinely needs a
few at once and a transaction holds one for its whole duration, but it never
needs ten and the extra is only a claim on a shared budget.

`pgbouncer=true` in the connection string does nothing: it is a parameter of
Prisma's old Rust engine and `pg` ignores it. Nothing is lost by that, because
node-postgres issues unnamed statements and the transaction pooler is safe
regardless. Do not read it as a setting that is doing work.

**The Nova Poshta limit was lifted** on 22.08: the directory moved into our own
tables, lookups are local, and only the hourly sync spends the key's budget.

### 9.2 Customer notifications (one message per channel, about the payment)
- **[done] The shop tells the customer one thing: that payment went through.** It
  says it once by letter and once by SMS, and a second message about the same event
  in the same channel must not exist. It is said at all because a closed tab takes
  the order number with it and the confirmation screen is the only other place it
  appears. Neither message announces the parcel: that is Nova Poshta's, and their
  notice reaches only a customer whose telephone the manager typed into the waybill
  by hand (§5.1.1), which nothing here can verify.

  **Two channels, because the number has to arrive.** Resend accepts a letter and
  somebody else decides where to put it — spam is a delivery the sender is told
  nothing about, and a mistyped address is a delivery to a stranger. The telephone is
  the one contact field the shop can lean on, since Nova Poshta needs it to be real.
  One channel would be a promise the shop cannot keep; three would be noise about an
  event the customer already knows about, having just paid.

  Both the key and the sending address are required, because Resend sends only
  from a domain whose DNS proves it is yours: `MAIL_FROM` is not a label, and
  pointed at an unverified domain every letter is refused. Its own fallback
  reaches the Resend account's address and nobody else, reporting as sent and
  arriving nowhere. Absent either, the shop behaves as it did before letters
  existed, the same shape as the Monobank and Nova Poshta keys.

  The letter's two marks are PNG and never the SVG the site uses, because
  Gmail, Outlook and Apple Mail between them either block SVG or draw nothing.
  Each is stored at twice its display size so a retina screen has pixels to
  use, and flattened onto white, because Outlook fringes PNG alpha with grey.
  Neither file may be renamed or repointed: letters already delivered fetch
  them from this server by those exact names, and breaking that breaks the mark
  in inboxes nobody can reach.

  The top mark names the shop in its `alt` and the closing one deliberately
  does not. A large share of clients hide images until the reader asks, and that
  box is 64px, so the alt is clipped to a broken "VASYLYN"; the sentence beside
  it already says VELUR in real text, so the mark claims nothing and blocked
  it leaves a small gap rather than a broken frame. That sentence is set in
  Georgia, because web fonts do not load in mail and the choice is between the
  serif every client already has and the same Helvetica as the rest of the
  letter, which would read as one more paragraph rather than as a voice.

- **[done] The SMS (TurboSMS) is not a short letter.** It carries the payment, the
  order number and a pointer at the carrier — no items, no total, no address, and no
  link, because order details have no public endpoint by design (§3.1). Anything the
  customer has to read twice belongs in the letter, which has room for it.

  **One part, and the text sits on the line.** The alphabet decides how long that
  is: GSM-7 gives 160 characters, and a single Cyrillic character forces UCS-2 and
  cuts it to 70. A split shows nowhere — it arrives, it reads correctly, and it
  costs twice on every paid order until somebody reads an invoice.
  `renderOrderPaidSms` is therefore pure and pinned by `npm run test`, which fails
  on the character after the ceiling. The shop's name is spent nowhere in the body because
  the sender is an alpha-name — registered, moderated, and capped at 11 characters
  itself, so an account can hold a working token that sends nothing until the name is
  approved.

  **A refusal arrives as HTTP 200.** The verdict is `response_code` in the envelope
  and the per-recipient `response_status` beneath it, never `res.ok`. The body echoes
  the recipient's telephone, so it is never logged (§3.6).

  **A failed SMS changes nothing.** `sendOrderPaidSms` returns false and never throws:
  the order is paid, the webhook still answers 200, and the ORDER_PAID audit entry
  records `sms` as sent, failed or not configured beside the letter and the Telegram
  notice. It does not raise `needsReview` — that flag means money needs a decision
  (§4.5), and an unsent text is not money. Both halves of the key are required, and
  absent either the shop behaves as it did before SMS existed, the same shape as the
  Monobank, Nova Poshta and Resend keys.

  **The customer's telephone reaches a third processor**, which the privacy policy
  names for that reason; changing its wording bumps `PRIVACY_POLICY_VERSION` in the
  same commit (§3.6).

### 9.3 Staff alerts (Telegram notifications on paid orders)
- **[done] An immediate Telegram notice to the administrator about a newly paid order.**
  `src/lib/telegram.ts` (`renderNewOrderMessage` / `notifyNewOrder`) tells the shop
  when a paid order has arrived.
  - **Paid, never placed:** Abandoned checkouts never pay, and notifying on order
    creation would generate noise that causes staff to mute the channel, missing
    real paid orders.
  - **Fail-safe execution:** Telegram dispatch runs behind the conditional payment
    update (`payments.ts`), in the same `Promise.all` as the customer's letter and SMS.
    `Promise.all` is safe only because none of the three ever rejects; each answers with
    a boolean instead. It must never throw or block the Monobank webhook response (200 OK).
  - **HTML sanitisation and formatting:** Product names, customer names and comments
    pass through strict HTML entity escaping (`escapeHtml`) before formatting. Telephone
    and email are formatted as plain text so Telegram links them natively for tap-to-call,
    while order IDs are wrapped in `<code>` for tap-to-copy into the admin search box.
  - **Privacy boundaries:** The message carries customer details; the chat holds
    personal data outside the automated retention scrubber (§3.6.1). Managing the
    chat's history is an operational policy requirement.

### 9.4 Storefront caching and on-demand revalidation
- **[done] Cache management and invalidation.** The storefront is statically cached
  with on-demand revalidation (`revalidateCatalog` and `revalidateHome` in
  `src/lib/revalidate.ts`).
  - **Route and tag dropping:** Rendered pages (`/`, `/catalog`, `/catalog/[slug]`)
    are dropped by route patterns. In addition, `revalidateCatalog()` purges the
    `CATALOG_TAG` cache tag used by `getPublishedProducts()` (`unstable_cache`),
    ensuring `POST /api/cart/resolve` and public catalog views reflect database edits
    instantly.
  - **Centralised write-path invalidation:** Admin write handlers (product create/update/reorder/delete,
    banner CRUD, category CRUD) call the revalidation helpers directly rather than
    scattering ad-hoc `revalidatePath` calls across the codebase.

### 9.5 Error tracking and observability (Sentry & Analytics)
- **[done] Sentry exception tracking.** `@sentry/node` in `src/instrumentation.ts`
  captures unhandled server exceptions and route crashes without bundling client SDK overhead.
  - **Scoped monitoring:** Captures unexpected 500 runtime errors. Domain anomalies
    (`PAYMENT_MISMATCH`, `PAYMENT_AFTER_CANCEL`, `PAYMENT_UNKNOWN_ORDER`) are handled as
    business states: they flag `needsReview` on the order and write to `audit_log`
    rather than flooding Sentry.
  - **Environment guards:** Reporting is disabled in development, disabled on Edge
    runtime (to prevent latency in `proxy.ts`), and disabled if `SENTRY_DSN` is absent
    or invalid.
  - **No `@sentry/nextjs` bundle bloat:** Client-side error tracking is intentionally
    omitted to comply with strict CSP (`connect-src 'self'`).
- **[done] Web analytics:** `@vercel/analytics` in the root layout collects aggregate,
  cookie-free pageview metrics served directly from the same origin (`/_vercel/insights/*`).

### 9.6 Legal compliance and seller identity
- **[done] Single source of truth for seller identity.** `SELLER` in `src/lib/storeContent.ts`
  centralises the seller's legal name, registration number (FOP), locality and contact info,
  complying with Article 7 of the Ukrainian Law on Electronic Commerce.
  - **Locality only, no private street addresses:** Sole trader registration addresses
    are redacted to city/locality level to protect privacy while preserving verification via tax ID.
  - **Mandatory legal pages:** `/offer` (Public Offer), `/privacy` (Privacy Policy),
    `/delivery` & `/returns` (14-day return rules), and `/contacts` read directly
    from this centralized configuration.

### 9.7 Edge proxy and routing lifecycle
- **[done] Next.js Edge proxy (`src/proxy.ts`).** Runs at the Edge before matched
  routes (`/admin/*`, `/api/*`, `/checkout/success`).
  - **Centralised rate limiting:** Evaluates client IP against in-memory and Upstash
    Redis buckets for sensitive endpoints (login, MFA verify, checkout, payment invoice,
    order release, cart resolve, webhook, delivery proxy, file upload).
  - **Session refresh:** Refreshes short-lived Supabase auth tokens before request execution
    and sets hardened `httpOnly` cookies in the response.
  - **Admin corridor enforcement:** Unauthenticated visitors accessing `/admin` are
    redirected to `/auth/login`. Authenticated staff lacking `aal2` (TOTP MFA) are
    strictly confined to `/admin/security` until second-factor verification is completed.

---

## 10. Before going live with real payments (checklist)
- [x] Confirmed that card data passes through neither our server nor our database (redirect to Monobank only)
- [x] The webhook verifies `X-Sign`, is idempotent, and the status changes on the webhook alone
- [x] The webhook checks the amount, the currency and the `invoiceId`; invoice creation is tied to a `paymentToken`
- [x] Security headers are set (CSP, HSTS, `X-Frame-Options`, `Referrer-Policy`)
- [x] `description` is plain text with no `dangerouslySetInnerHTML`; there is no
  rich-text editor (§2), so no sanitising is needed
- [x] One caller writes `PAID`; confirming a payment by hand has been removed
- [x] The checkout refuses without `MONOBANK_API_TOKEN`
- [x] The delivery address comes from the Nova Poshta directory while the directory answers (§5.2)
- [x] **`vercel.json` → `*/10 * * * *`**, done together with the move to Vercel
  Pro. On a daily schedule an abandoned basket held its goods for up to 24 hours
  instead of 30 minutes, and from minute 31 the buyer could neither pay for the
  order nor hand it back
- [x] Media moved to Supabase Storage (§6)
- [x] Upload limits pass under Vercel's request body ceiling (about 4.5 MB): 4 MB
  for photographs and video, checked in the browser. Before that a 10 MB limit
  meant a photograph straight from a camera would not upload at all
- [x] 2FA is implemented: the code step, the `aal2` requirement, the enrolment
  screen, and a reset by the owner
- [ ] Every admin account has been through enrolment (verified by eye, not by
  code). **Nothing needs enabling in Supabase**: TOTP is available by default on
  every plan. What costs money is enforced MFA for signing into the Supabase
  panel itself (an organisation setting), and that is a different thing: it
  protects your Supabase account, not the shop's admin panel
- [x] Rate limiting is active on checkout, sign-in, the payment form, the webhook and uploads
- [ ] `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are set in production.
  The rules above always apply, but without Upstash the counter lives in the
  instance's memory (§3.2), and on serverless that multiplies every limit by the
  number of instances
- [x] The action journal is written to the database and readable by the owner: a
  payment mismatch (`PAYMENT_MISMATCH`) no longer disappears without trace
- [ ] Sentry logs no cards, passwords or addresses
- [ ] An independent security review (pentest) has been carried out before handover

---
## 11. Deliberate departures from the letter of the spec

Decisions where the implementation knowingly differs from the text above.
Recorded so that nobody "fixes" them back:

- **The CSP keeps `script-src 'unsafe-inline'`.** Next injects an inline
  bootstrap on every page. The nonce alternative requires routing **every** page
  through `src/proxy.ts` (whose matcher today is only `/admin` and `/api`), which
  puts an edge invocation on every request. The remaining directives are set
  strictly. Revisit when there is a separate reason to widen the matcher.
- **`'unsafe-eval'` is added in development only.** React uses `eval` in
  development to rebuild stack traces and produce readable errors; in production
  it never does. Refusing it everywhere bought no security on the deployed site
  and cost every error message during development. The condition is
  `NODE_ENV === "development"` in `next.config.ts`; **the policy that ships is
  unchanged.**
- **The order number is formatted in Kyiv time on the server.** §9 requires
  conversion to Kyiv time to happen on the client, and for **stored** timestamps
  it does: they are all `DateTime` in UTC and `toOrder` returns `toISOString`.
  There is one exception, `generateOrderId`, where the date is part of the
  identifier itself (`VSL-20260819-A1B2C`). That is not a stored time but a label
  a manager reads aloud on the telephone, and it has to match the day they think
  it is.
- **Uploads go through our own route rather than a presigned direct upload (§6).**
  The sharp re-encode is not only compression: it is what strips EXIF and rejects
  files that are not images, because `file.type` comes from the client. A direct
  upload to the bucket goes past that check, so following the letter of the spec
  here would be less safe. The photo limit is 4 MB, set by Vercel's request body
  ceiling rather than by preference (§6).

---

---

## 12. Deliberately deferred (not doing this now)

### 12.1 International delivery, deferred
The decision: at this stage the shop works **within Ukraine only and through
Nova Poshta only**. The international delivery code (30-odd countries, per-country
phone and postcode validators, an offline directory of Nova Post branches abroad,
tariff zones) was deleted. It did not work (the country selector was hard-coded
to Ukraine) and it created a false impression of readiness.

Coming back to it will need:
- A separate integration with **Nova Poshta Global**, a different API and a
  different process from domestic waybills (see §5).
- Country and postcode fields back in the model, and per-country validators in
  `validation.ts`.
- Customs notices in the UI and rules about destination-country tax.
- A decision about currency: under §5, payment stays in hryvnia.

### 12.2 Other carriers, not planned
Ukrposhta and Meest are gone for good, by a business decision. The architecture
takes it: the frontend calls `/api/delivery/*` and never sees a carrier's name,
so adding another one is a new implementation behind the same interface.

### 12.3 The rest, by the phases at the top of this document
Direct upload to Supabase Storage (§6), concurrency control (§8), PRRO and
notifications (§9) stay in the spec unchanged and wait for their phase.

**Product variants are no longer on this list.** They were cancelled (§2), and
that decision is closed rather than deferred: a product is one thing with one
price and one stock count. This paragraph used to say variants were "waiting for
their phase" and contradicted §2 in the same document. The box matrix is gone for
good, see §5.

---

### 12.4 The client's requirements for the database phase

These have to be in the schema **from the start**, not bolted on afterwards:

- **The panel must match the data model exactly.** If a field exists in the
  database it is editable in the panel; if the panel offers something, the
  storefront is obliged to show it. An example of how not to do it, since fixed:
  the badge field was free text offering "Premium", "Limited Edition" and "Must
  Have", while `getBadge` understood only "New" and "Bestseller". The rest
  was stored and silently ignored.
- **Badges are a closed list, not free text:**
  - manual, chosen by a manager: `NEW` ("New"), `BESTSELLER` ("Bestseller");
  - automatic and not editable: "Sale" (an old price is set) and "Out of
    stock" (stock is 0). "Last few left" (stock 1 to 5) was built and later
    removed;
  - a card shows one badge, by priority: availability → sale → manual. There is
    no fourth step for scarcity any more, see the line above;
  - arbitrary badges are deliberately not possible, or a manager could write
    something that contradicts the product's real state.
- **Product descriptions** must support variable fields in the same way
  (characteristics as key-value pairs, §2, EAV through JSONB).
- **Roles are checked against an explicit list.** The admin guard asks "is this
  role in the allowed list", not "is this person signed in". Otherwise
  introducing customer registration would open the panel to customers
  automatically.
- **Telephone numbers are not validated against a list of operator codes.** Only
  the structure is checked: nine digits after `+380`, the first of them 3 to 9. A
  whitelist of codes goes stale every time the regulator issues a new one, and
  the cost is asymmetric: a real customer cannot place an order, and nobody finds
  out.

### 12.5 CAPTCHA, rejected

§3.2 proposed Cloudflare Turnstile on the checkout and the sign-in form "when
suspicious activity passes a threshold". We are not doing it, and that is a
decision rather than an oversight.

What it was meant to protect is already covered by more precise means. Sign-in
has **three** limit windows (5 a minute by IP, 5 per 15 minutes and 20 per day by
account), and only failed attempts count. Placing an order is limited by IP over
the reservation window, and beyond that by three unpaid orders per telephone
number **inside the transaction**. Payment has a ceiling of five attempts per
order, enforced in the `WHERE` clause.

Its cost, meanwhile, is real and falls on the checkout, which is exactly where
every extra obstacle costs a sale. This is the same asymmetry that made §12.4
reject a whitelist of operator codes: a wrong refusal costs a customer nobody
ever hears about.

Come back to it if the journal ever shows a pattern the current limits do not
hold.
