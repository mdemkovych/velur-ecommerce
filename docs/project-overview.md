# VELUR — project overview

A document for a non-technical reader: what this site is, which pages it has, what
happens on each of them, and how the data and the admin panel are arranged.

**Technical requirements:** `docs/architecture.md`

---

## 1. What this is

An online cosmetics shop for the Ukrainian brand VELUR. A shopper picks a product,
fills a basket, places an order with Nova Poshta delivery and pays online. The owner
and the managers run products and orders through a separate admin panel.

**Limits accepted deliberately:**

| Decision | Why |
|---|---|
| Ukraine only | International delivery was removed; the reasoning is in architecture §12.1 |
| Nova Poshta only | Ukrposhta and Meest were dropped. The frontend never sees the carrier's name, so replacing it would not touch the interface |
| Online payment only | Goods are paid for by card in advance. Delivery is paid by the recipient at the branch |
| Language | The interface is in Ukrainian in the live shop; this copy is translated. A product also carries a Latin name, used for addresses |

---

## 2. Where the project stands

**Working:** the catalogue, the product page, the basket, the wishlist, checkout,
order placement, the admin panel (products, orders, home-page banners, the team),
access control and the action journal. Photographs are kept in cloud storage.

**What depends on outside keys:**

- **Monobank** — the key is in place. **Without it the shop takes no orders at
  all**: the shopper sees "Payment is temporarily unavailable" with a link to the
  contacts page. An order used to be created anyway and a manager arranged payment
  by telephone; that mode was removed.
- **Nova Poshta** — the key is in place. While the directory answers, the city and
  the branch **must be picked from the list**: anything typed by hand is refused.
  If the key expires or the directory goes quiet, that rule lifts by itself and the
  address can be typed in — the shop keeps selling.
  The shop keeps its own copy of the cities and branches and **refreshes it daily**:
  branches open and close, and a stale row in a list looks exactly as convincing as
  a real one.

**Done, of the things that used to block launch:**

- a database — products, orders and accounts live in PostgreSQL; two shoppers can no
  longer buy the same last unit, and the data survives a deployment
- sign-in through Supabase — the shop never stores a password, and two-factor
  sign-in is **compulsory**: until it is set up, the panel lets nobody anywhere
  except the Security page (§4.7). There is deliberately no public "forgot my
  password" form — a manager's new password is issued by the owner
- the action journal moved into the database; in a file it simply was not written
  on the host at all
- photographs moved to cloud storage. They used to sit on the server's own disk and
  vanished with every deployment, and uploading a new one from the panel was
  impossible
- the home-page banners are edited in the panel; they used to be written into the code

**Not done (each needs work of its own):**

- ~~the seller's registration details on the legal pages~~ — **filled in**, from
  the state register extract and the trademark certificate
- ~~the payment email to the customer~~ — **done**: after a successful payment a
  letter arrives with the logo, the number, the contents of the order and the
  branch. News of the parcel itself comes from Nova Poshta, once a manager writes
  the waybill (and only if they put the customer's telephone on it)
- ~~the payment SMS to the customer~~ — **done**: straight after payment, one
  message with the order number goes to the telephone on the order. The shop
  addresses a customer once per channel and only about the payment; the SMS does not
  retell the letter — it carries no contents, no sum and no links, because the whole
  of it lives inside 70 characters
- ~~the sale notification~~ — **done**: the moment a payment goes through, Telegram
  receives the order number, what to pack and for how much, along with the
  customer's name, telephone, email, branch and note — so the goods can be picked
  and sent without opening the panel
- fiscalisation (PRRO) — the one thing genuinely still outstanding

**Waybill generation is absent from that list on purpose.** It is not a debt but a
closed decision: a manager writes waybills by hand in Nova Poshta's own cabinet
(`architecture.md` §5.1.1). The shop stores the city and branch codes, not so that it
can one day write waybills itself, but to prove that the chosen branch really exists.

---
## 3. The shopper's pages

### 3.1 Home `/`

A full-height banner: campaign photographs with an eyebrow line, a heading and up to
two buttons over them. There can be up to three banners, moved by arrows and dots on
any device.

**A banner is always three photographs.** There is no banner type any more (one, two
or three photographs used to be a choice): that choice changed the shape of every
frame at every width at once, and the result could only be seen on the live site.

**How many photographs are visible depends on the screen:** all three on a desktop,
the first two on a tablet, only the first on a phone. The ones that drop are always
the later ones, so **everybody sees the first photograph** — that is the one a
manager should make primary.

Below desktop the banner stops short of the bottom edge by exactly the height of the
footer's first band, so it is visible that the page continues.

**The carousel moves by itself on a desktop only.** On a phone a banner changes only
when somebody moves it: a heading that vanishes mid-sentence is a different thing
from one you turned yourself.

All of this is run from the panel — see §4.5.

### 3.2 Catalogue `/catalog`

A grid of cards: two columns on a phone, four on a wide screen. Every product loads
at once — the catalogue is small, and it **is** the collection; there is deliberately
no "show more" button (architecture §7).

**A sticky bar at the top** (it does not disappear on scroll):
- an "All" button with a counter and a "Choose a category" menu — a menu rather than
  a row of tabs, so that nothing hides or wraps however many categories there are
- search by name, Latin name, tagline, description and code
- sorting: default / price ascending / price descending

Categories are derived from the **actual products**, so a category created in the
panel appears at once. When there are many, the bar scrolls sideways and a gradient
on the right hints at it.

**Every category also has a page of its own** — `/catalog/category/<name>`, for
instance `/catalog/category/body`. It shows the same products already filtered, and
it exists not for the shopper but for the search engine: at an address with a query
string (`/catalog?category=body`) Google does not see a category, whereas at a page
of its own it does, and that is what catches searches like "body cream buy".

The heading and description of that page come from the category name you set in the
panel. There is no separate text per category yet: the category model holds only a
name and a position. If such a text is ever wanted, a field for it has to be added to
the editor first — so that it stays something you control rather than something wired
into the code.

Filters live in the address (`/catalog?category=face&q=cream`), so a link can be
shared and opens the same view.

**A product card** shows a photograph (4:5), the Ukrainian name, and below it the
Latin name and the price on one line (the old price struck through during a
promotion), a heart for the wishlist and **one badge** (the rules are in §6.2). The
card's corners are rounded by 2px — the only place on the site, besides the colour
dots, where that is allowed.

On tablet and desktop a purchase bar sits under the price: a quantity counter and an
"Add to basket" button. It is always visible and does not react to hover — otherwise
the card would grow under the cursor and shift a whole row of the grid. On a phone
there is no bar: with no hover it would have to stand on every card permanently, and
the product page is one tap away anyway.

### 3.3 Product page `/catalog/[slug]`

- **Gallery:** a large photograph or clip with a column of thumbnails on the left, up
  to five items. One layout on every device — only the column's width changes. The
  column is always divided into **five slots**, however many photographs there are: a
  thumbnail is the same size with two photographs as with five, and empty slots simply
  stay empty. Each slot is 4:5 — the same shape the photograph is stored in, so
  nothing is cropped and no grey bands are left. The active thumbnail is marked by
  brightness, without a frame. The main photograph is swiped; a product with one
  photograph is shown at the same size as in the grid, centred
- **A clip** has a player of its own: a play button in the middle of the frame, and a
  bar below with the time, scrubbing and sound. There is no full-screen mode. Sound is
  off until the shopper turns it on. **A clip never starts by itself** — until it is
  pressed, a still frame with a button is shown and not a byte of video is fetched.
  It used to start as soon as a shopper scrolled to it; that was the most expensive
  spot on the site, because a clip reaches the shopper **straight from storage**, and
  every idle swipe cost a whole file
- **Price:** the old one struck through and the new one in red during a promotion
- **A quantity counter** capped by the stock, and an "Add to basket" button. After
  adding, the counter returns to 1. The shop counts what is **already in the basket**
  as well: putting in more than exists is impossible, and a shopper who tries is told
  how much is left
- **Out of stock** — a "tell me when it is back" form (it does not send yet)
- How much is left is written **only when a shopper asks for more than there is**. A
  permanent red line under every product is pressure, not information
- **The accordion:** 01 Product description · 02 Specifications and ingredients ·
  03 How to use · 04 Delivery and packaging

### 3.4 Basket and wishlist

The basket keeps only **which** products were chosen in the browser, never their
prices. So on returning, a shopper sees the current price and availability rather than
last week's. If something changed in between, the shop says so: "2 pcs left, the
quantity was reduced" or "this product is no longer available". The notice does not
disappear by itself — it waits until it has been read.

A side drawer, shared by both, switches between them with tabs. The quantity can be
changed, an item removed, or moved from the wishlist into the basket. The contents
live in the browser, so the basket is still there on returning.

When something is added, a compact notice appears at the top right — "Added to the
basket" — with a countdown bar; it goes after 3.5 seconds or on the cross. Clicking
the text opens the matching tab.

### 3.5 Checkout `/checkout`

Three sections, all open at once. A section's number fills in and gains a tick once it
is correctly filled — showing the sequence without stopping anybody.

The button at the bottom is grey while the form is incomplete, **but it can still be
pressed**: in answer, the shop highlights every unfilled field and scrolls to the
first of them. A disabled button explains nothing about what it wants.

**1. Contact details** — first name, last name (capitalised automatically), telephone
(+380 is fixed, formatted as `99 123 45 67`), email.

**2. Delivery** — the type (branch or parcel locker, or courier), the city and branch
from Nova Poshta's suggestions, or street, house and flat. A "Notes for the order"
field.

**The city and the branch are picked from a list, not typed.** Until a city is
chosen, the branch field (or the street, for a courier) does not open — a branch
belongs to a city. Anything typed by hand is highlighted red and the payment button
stays grey: an address that is not in the directory is a parcel that cannot be sent.

If the directory does not answer, there are no suggestions and the rule lifts: an
explanation appears — "Suggestions are unavailable. Enter the city and branch by hand
— check the spelling carefully."

The "Notes for the order" field is folded behind a button: almost nobody writes one,
and an empty box reads as yet another required field.

If availability changes while the shopper is filling the form, the shop says so with a
**red banner above the form** rather than a line in the order summary: somebody typing
an address is not reading the summary, and finding out about the problem by pressing
the button is the worst of the available moments.

**3. Payment** — mono pay. It is noted that delivery is not part of the total and is
paid on collection. A compulsory consent box for personal data processing.

**The order contents, the goods total and the summary** sit to the right of the form
on a wide screen (from 1280px; anything narrower, a tablet in portrait included, has
no room for two columns). On every other device that block moves to the **top of the
page**, folded to a single line with the sum: a shopper sees what they are paying for
before filling anything in, and unfolds it when they want to check. The confirmation
button there stands immediately after the third section — where the work ended, rather
than inside the details below.

Delivery is marked "at the carrier's own rates" with no figure: the recipient pays it
at the branch. The carrier is not named in the summary, so that replacing it would not
mean editing text across several screens. The button locks while the order is being
sent, so that two orders cannot be created.

### 3.6 Confirmation `/checkout/success`

The order number and the sum. The data comes from the browser's memory — **there is no
address at which somebody else's order can be looked at**.

It shows the contents of the order: the items, quantities, line totals, where the
parcel is going and the order number. The shopper's browser stores that at the moment
of ordering, which is why another device shows only the number and the sum.

The page shows one of four states, and it is the **server** that decides which, not
the browser:

- **payment confirmed** — the bank answered that the payment went through;
- **order accepted** — there is no answer yet, or online payment is not configured;
- **payment not completed** — cancelled, declined or expired; the goods stay reserved,
  and the screen carries a "Try paying again" button, which leads to a new bank page
  while the previous one stops working. There are five attempts per order; once they
  are spent, or the time has passed, the button says so plainly. In the "order
  accepted" state there is deliberately no button: a payment may still be on its way
  there, and a retry would harm one that is about to succeed.
- **order cancelled** — the payment was not completed in time, the reservation lapsed
  and the goods went back on sale. A state of its own rather than a variant of the
  previous one: there, the goods are still held for the shopper; here that is no
  longer true and there is nothing to retry.

How the shop knows: the page is assembled **on the server**. From the address it
receives only the order number and a signed key issued during checkout — and on the
server it checks the key, looks at the order and asks the bank if it needs to. The
result is not in the address, so "paid" cannot be typed into it: that used to paint
"the payment went through" on the visitor's own screen (nothing changed in the
database, of course, and a manager saw an unpaid order), and now the page simply has
nothing to take from such an address.

Without a valid key the page says nothing about the order — it shows a neutral "order
accepted". That is deliberate: order numbers are short, and otherwise anybody
substituting somebody else's number would learn whether it had been paid.

The page promises no letter, and will not, although the letter exists. It simply does
not know about it: the letter is sent from the webhook, after the screen has been
drawn, and without a verified domain it is not sent at all. A promise the page cannot
check is the very thing it was cured of.

If the shopper presses "back" on the bank's page, the shop **cancels the unfinished
order itself**: the goods return to stock and to the basket, and an explanation appears
above — "the order was cancelled, the items are back in the basket, change what you
need and order again". From there the person freely changes the basket or their own
details, and checking out creates a new order with a new invoice.

It is done that way because a placed order is not a draft: it already holds the goods
for the shopper, and its prices and total are frozen. Editing it is impossible, whereas
cancelling and ordering again is simple and safe.

The one exception: before cancelling, the shop asks the bank whether the money has
already gone. If a payment is being processed, nothing is cancelled — the shopper is
taken to the confirmation screen.

### 3.7 Other pages

`/about` — the brand page: a full-width cover with the name at the top and a caption
at the bottom sitting directly on the photograph, the founder's story beside a
portrait, a gallery of object shots in the "A ritual of self-love" section — swiped on
a phone — and a closing band of two photographs carrying three lines and a button into
the catalogue. The photographs live in the code (`public/`), not in the panel: unlike
the home-page banners, they cannot be changed without a developer.

On every storefront page, in the bottom-left corner, there is a round contact button.
It opens a panel with Telegram and a telephone number without blocking the page, and
it can be tucked into a tab at the edge by dragging it to the left. Scrolled to the
very bottom, it stops above the footer rather than lying on it. Its contacts come from
`storeContent.ts`, not from the panel.

`/auth/login` — the admin sign-in.

The legal pages, reached from the footer on every page: `/contacts`, `/delivery`
(delivery and payment), `/returns` (exchange and returns), `/offer` (the public offer)
and `/privacy` (the privacy policy).

404 — a heading, an explanation and two buttons. There is no automatic return to the
home page: it broke the browser's back button and pulled the page out from under
anybody still reading the address.

---

## 4. The admin panel

Sign-in is at `/auth/login`. The panel has a header of its own and shows neither the
site's header nor its footer.

**Sections are separate addresses**, so each can be linked to and the browser's back
button behaves as expected:

| Address | Section |
|---|---|
| `/admin` | redirects to products |
| `/admin/products` | the product list |
| `/admin/products/[id]` | editing a product (`/new` — creating one) |
| `/admin/orders` | orders (the journal) |
| `/admin/orders/[id]` | one order — returns, waybill, note, status |
| `/admin/team` | the team (the icon in the header) |

### 4.1 Products

Cards with a photograph, name, price and category. Search and a category filter.

**The order of the cards here is the order of the products in the catalogue.** The
arrows on a photograph move a product one place forward or back. While a rearrangement
is unsaved, a bar hangs below the header with "Save the order" and "Cancel": shoppers
see the change only once it is saved. A new product goes first. There is one order for
the whole catalogue: the category tabs show the same sequence, only shorter. For a
shopper this is the "Recommended" sorting; if they choose to sort by price, the shop's
order gives way to their choice. **Clicking anywhere on a card** opens the editor; the
"Delete" button is separate.

Deleting means **hiding**: the product leaves the catalogue but stays in the database,
because old orders point at it. Hidden products have a tab of their own — the
photographs on their cards are grey, and any of them can be **restored** with one
press.

### 4.2 The product editor

- **Photographs and clips** — up to five items together; dragging changes the order and
  the first becomes primary. Photographs are compressed to WebP automatically **and
  cropped from the centre to 4:5** — the same ratio the site displays them at. They
  used to be fitted into 4:5 with grey padding instead, but the site crops every
  photograph to its own frame, so those grey bands came back into the visible part.
  Upload originals of **at least 2048×2560**: processing never enlarges an image, so a
  smaller file yields a smaller and softer frame. A banner photograph is the exception:
  it keeps its own proportions, because the banner does the cropping itself. A clip is
  **up to 4 MB and 20 seconds, one per product**, MP4 only, and it **is never the
  primary item**: the catalogue card and the basket show a photograph. The server
  checks that a file really is what it claims to be
- **The main details** — the names, the price, the old price for a promotion, the
  category, the stock
- **Specifications** — free "name → value" pairs (volume, skin type, scent…)
- **How to use** — the text for the accordion
- **Delivery and packaging** — the text of block 04, written for each product
  separately. Nothing is substituted by default: copy on a live page that a manager
  cannot find in the panel is exactly what was being fixed
- **Badges** — a choice of two (§6.2)

Categories are created and renamed right here — **both the name and the Latin
address** (`candles`). Changing the address was forbidden at first, because it is in
the catalogue's links; that made a single typo permanent — `candels` would have stayed
in the address forever. Now it can be corrected, the form warns that links already
shared will stop working, and the manager decides. The name a shopper sees can be
changed at any time with no consequences. The basic ones: body care, face care, gift
sets, scented candles, accessories, hair care.

**If the form is filled in wrongly**, the shop says which field and what is wrong with
it, as a line under that field rather than a general "could not save".

### 4.3 Orders

Two figures at the top: how many orders there are, and how many await dispatch. Below
them a period ("today", "week", "month", "year", "all time"), and it governs both
things at once: the order count and the list underneath. "Awaiting dispatch" has no
period — it is a queue, and a queue is always now.

Both figures are counted by the database, and it counts the **whole shop** rather than
the slice of the list currently on screen: the archive and the search do not narrow
them, the period does. "Today" is a Kyiv day, so an order placed at eleven at night
counts as today's, and a week starts on Monday. While the figures are still loading,
the tiles show a dash rather than a zero: a zero here is indistinguishable from "not
counted yet".

Search by number, name, telephone, email or waybill — several words at once are
allowed, and what is found contains all of them ("Petrenko 099"). A status filter. A
status can be changed straight from the list on desktop and tablet; on a phone the
order itself has to be opened. Changing a status does not hide the card — it stays in
place until the list is loaded again.

**The list shows twenty orders at a time**, with "Show more" at the bottom. The shop
can accumulate any number of orders, and the journal opens just as quickly at the
fiftieth as at the five-thousandth. Search and filters look through **all** orders,
not the twenty on screen.

An order card carries: the number, the date, the status, the customer's contacts, the
delivery address, the payment method, the customer's note (in yellow), the manager's
internal note (its first two lines — the whole of it is on the order page), the
waybill, the contents and the total.

**Returns.** Against each line, how many units came back can be recorded. The shop
**moves no money** — the refund is made by the owner in the Monobank cabinet; the panel
only records it, so that "paid turnover" does not show money that is no longer there.
The card shows the returned sum and how much is left to the shop. Stock is **not**
credited automatically: returned cosmetics may have been opened, and that is decided by
the person holding them.

If the **whole** order came back, its status is set to "Returned", as before.

**A red "Needs a payment check" flag** appears when something happened to the money
that cannot be resolved automatically: the sum did not match what was expected, or a
payment arrived for an order already cancelled. Such an order must not be shipped until
the payment has been checked against the statement. A person clears the flag.

**The archive.** A finished order — delivered, cancelled or returned — can be taken out
of the journal with the "Archive" button, an icon in the corner of the card, and it asks
for confirmation. The card leaves the list at once. It goes nowhere: it sits on a tab of
its own and comes back with one press. Orders still awaiting payment or dispatch cannot
be filed away — they are the very reason the journal exists.

**Deleting for good** is possible only for a cancelled order, only on its own page and
only with a confirmation. It is for an empty trace: an abandoned basket, or a form
filled with invented details — such a record documents nothing while holding a
stranger's data. An order that money passed through, or that carries an unresolved
question about payment, cannot be deleted: there the trace is needed. The action
journal keeps a record of the deletion — with the sum, but without a name or a
telephone.

**Clicking the order number** opens its page, where everything concerning that order
happens. In the list the waybill and the note are only displayed; they are typed in
here.

**The customer's details can be corrected.** Name, telephone, email, city, branch or
address, notes — all editable while the order has not shipped. The city and branch come
from the same Nova Poshta suggestions as at checkout. After "Shipped" the button
disappears: the waybill is already written, and changing the address here would part it
from the one on the parcel.

**Striking an item off, or recording a return.** These are the same control, and what
it does depends on whether the parcel has already left.

*Before dispatch* (the order is paid) a customer may ring and ask to drop one item —
the manager enters how many units to strike off, and the goods return to sale
immediately: they never left the warehouse. There used to be no such path at all: the
whole order had to be cancelled and the person asked to place it again.

*After dispatch* it is a return: the manager enters how many units of each product came
back, and ticks "the goods are intact — put them back on the shelf" if they really can
be sold again. The tick is not set by default: a returned cream may be open, and that
is decided by the person looking at it. The photograph of a returned item turns grey
with the word "RETURNED", and the summary shows how much was returned and how much is
left to the shop.

**The shop refunds no money.** Refunds are made by the owner in the Monobank cabinet —
the site only records what came back, so that the turnover tells the truth.

**An unpaid order cannot be marked shipped** — only cancelled. Only the bank sets the
"Paid" status.

**A shipped order can no longer be cancelled** — only marked delivered, or returned. The
parcel is on its way, and putting its goods "back on the shelf" would offer for sale
what is not to hand. When it comes back, the manager returns the goods to sale line by
line.

**Every status change asks again** and explains the consequence — "Shipped" in
particular warns that after it there is no cancelling.

**Cancelling a paid order carries its own reminder about the money.** The goods return
to the shelf and the order closes — while the customer's money stays in the Monobank
account, because the shop moves no money at all. The refund is made by the owner in the
Monobank cabinet, and it is recorded nowhere in the system, so the warning is the only
thing that mentions it. For an unpaid order that sentence is absent: there is nothing
to return.

A manager can **change the status**, **enter a waybill number** and leave an
**internal note**. Payment statuses cannot be set by hand — only the bank sets them
(§6.3).

**The internal note** is not the same as the "customer's note" above. The customer
wrote theirs at checkout and it is not editable. The note is what a manager writes for
themselves: what was agreed by telephone, what to check before dispatch, why an order
was held up. The customer never sees it.

### 4.4 The team

A list of accounts with a role and an access state. The owner can add a manager and
switch access off. A manager sees the list but does not change it.

Switching off is **not deletion**: the account stays, so that the history in the
journal keeps pointing at a real person.

**A manager's forgotten password:** the owner presses "New password", types a new one
and hands it over in person. A manager cannot change their own password, and the shop
has no public "forgot my password" form — for two accounts that is a door too many.

**When somebody leaves** — "Switch access off". The account stays (the journal must
point at a real person) but signing in no longer works, and it takes effect at once
rather than when a session expires. There is no account deletion in the panel at all.

### 4.5 Banners

The first screen of the home page. The list shows every banner in the order they are
cycled through; each can be moved up or down, switched off and deleted. **Up to three
are on at once**: a fourth would never be seen by a shopper, so the shop says so
rather than swallowing it silently.

In the editor: photographs (**exactly three**), the line above the heading, the heading
itself and up to two buttons with addresses. There is no banner type any more.

**About photograph size.** The shop does **not** force a banner photograph into a
format, unlike a product photograph: a banner's cell is a different shape at every
screen width, so the banner crops it itself, from the centre, at display time.

**What is saved appears on the site at once.** The home page used to be assembled in
advance, and a banner change appeared only after a developer redeployed the site — so
banners, moved into the panel precisely to be independent of a developer, depended on
one anyway. That is fixed.

The heading picks its own type size from its length — it is not asked to fit somebody
else's layout.

---

### 4.6 The action journal

Who changed what, and when — written automatically. The owner sees everything,
including sign-ins and IP addresses; a manager sees only what happened to orders and
their money, without IP addresses.

**The owner may delete a single entry** — a bin icon at the end of the row, with a
confirmation. With one exception: **a record of a deletion cannot be deleted.** So
anything can be removed, but the trace "the owner deleted such-and-such an entry, at
such a time" stays forever. Otherwise the journal could be emptied so thoroughly that
nobody could later tell it from a journal nothing was ever written to.

Deletion is one entry at a time, with no "clear all": a sweep is exactly what turns
thinning a journal into destroying it.

**There is no customer data in the journal.** It records what the staff did — who
changed what in the panel. The one place a shopper's IP address used to be kept has
been removed.

### 4.7 Security — two-factor sign-in

Besides a password, signing in to the panel requires a six-digit code from an app on
your phone (any authenticator will do). A stolen password without the phone no longer
opens the panel.

It is set up on the **Security** page — there is a QR code to scan with the app, and a
field for the first code. **Until 2FA is set up, the rest of the panel is out of
reach**: the shop lets you onto that page and nowhere else.

**Your own 2FA can only be switched off with a current code** — that is, with the phone
to hand. Otherwise a stolen session would drop the protection with one press.

**Turn backup on in the app**, so that the codes are kept in a backup. A lost phone
then does not mean lost access: install the app on a new one, sign in with the same
account, and the codes are back. Without a backup they vanish with the phone.

The QR code is a common standard and any authenticator will read it. What matters is
the backup setting, not the brand of the app.

**If the phone is lost anyway:**

- **For a manager** — the owner resets 2FA with a button in the Team section, after
  which the person sets the app up again.
- **For the owner** — in the Supabase dashboard: Authentication → Users → the account →
  Danger zone → "Remove MFA factors". The owner cannot reset their own 2FA inside the
  shop's panel, and that is deliberate: otherwise whoever stole a session would drop
  the protection themselves.

Which is why the owner needs a backed-up app most of all — with one, neither of those
paths is ever needed.

### 4.8 How long a customer's data is kept

An order lives for three years from the date it was placed — the limitation period, and
the retention period for primary documents. After that a nightly job **erases the
person but keeps the purchase**: name, telephone, email, address and comment go, while
the sum, the items and the dates stay, anonymised.

That is because tax accounting requires the fact of the sale to be kept, while the
personal data law requires the person not to be kept longer than necessary. Erasing
satisfies both, and your turnover for past years does not change.

For the shop's first three years this job does nothing — which is a working state, not
a fault.


## 5. Data

PostgreSQL on Supabase through Prisma. The schema is `prisma/schema.prisma`. The
photograph files themselves live in Supabase Storage, and the database keeps links to
them.

### 5.1 Product

A product is one thing with one price and one stock figure. Variants (volumes and
shades) were in the model and were removed: the range has none.

| Field | Description |
|---|---|
| `id` | internal identifier |
| `slug` | the page address, e.g. `body-cream` — typed by a manager |
| `nameUk` / `name` | the Ukrainian name / the Latin one |
| `category` | the category code |
| `tagline` | a short subheading |
| `description` | the description |
| `usage` | how to use it |
| `specifications` | specifications as "name → value" pairs |
| `media` | photographs and short clips in one list (up to 5) |
| `price` | the ordinary price in hryvnia, a whole number |
| `promotionalPrice` | the promotional price; while it is set, that is what the shopper pays and `price` is shown struck through. It must be lower than `price` |
| `stock` | how many units are left |
| `badge` | `NEW` or `BESTSELLER`, or empty |
| `isDeleted` | a hidden product |

### 5.2 Order

| Field | Description |
|---|---|
| `id` | e.g. `VSL-20260813-A1B2C` (the date in Kyiv time) |
| `createdAt` | when it was created |
| `status` | the state (§6.3) |
| `customer` | contacts, city, delivery method, branch or address, notes |
| `items` | the lines, **with the price frozen at the moment of purchase** |
| `total` | the sum, computed by the server |
| `invoiceId`, `paidAt` | payment details |
| `paymentAttempts` | a counter of payment attempts (protection against card enumeration) |
| `trackingNumber` | the waybill number |
| `managerNote` | the internal note |

**`cityRef` and `branchRef`** are Nova Poshta's own codes, the unambiguous identity of
a branch. They are stored **not** for generating waybills automatically — that is not
going to happen — but so that the shop can prove the chosen branch really exists and
belongs to the chosen city. The check is made before the order is created.

**Prices in an order are frozen.** If a product's price changes tomorrow, the old order
still shows the sum the customer actually paid.

### 5.3 User

`id`, `email`, `name`, `role`, `isActive`, `createdAt`.

**The shop stores no passwords.** Supabase looks after them, along with password resets
and two-factor sign-in. Our database keeps only what decides access rights, and that is
checked on every request: switch a manager off and they lose access that same second,
without waiting for a sign-in to expire.

Roles: **OWNER**, **MANAGER**, and **CUSTOMER** — reserved for future self-registration
and granting no access to the panel.

---

## 6. The rules the shop lives by

### 6.1 The server computes the price

The browser sends **only product codes and quantities**. The server takes the prices
and the total from its own catalogue.

This is not a formality: otherwise a shopper could substitute the sum in the request and
place an order for one hryvnia. It has been checked — a "sum" that is sent is ignored.

### 6.2 One badge per card

Badges do not mix — **one** is shown, by priority:

1. **Out of stock** — the stock is 0
2. **Sale** — a promotional price is set
3. **New** / **Bestseller** — chosen by a manager

"Last few left" was the fourth and was removed: it lost every time a product was new or
discounted, and it is a different kind of statement by nature — "new" describes the
product, "2 left" pushes a decision. The product page mentions the stock only when a
shopper asks for more than there is.

There are only two manual badges, and free text is impossible. The reason: otherwise a
manager could write "Bestseller" on a product with two units left, or "New" on last
year's — and the label would contradict the truth. Availability and a discount override
a manual badge for exactly that reason.

### 6.3 The order lifecycle

```
Awaiting payment → Paid → Shipped → Delivered
                    ↓
            Cancelled / Returned
```

**Only the bank sets "Paid", with no exceptions.** A manager cannot set that status by
any means — the "confirm payment by hand" button no longer exists: the shop accounts
for money that moved **through the shop**. And a shopper returning to the "thank you"
page confirms nothing — that address can simply be typed into a browser. The status
changes only on a confirmed message from Monobank with a verified signature.

Cancelling **returns the goods to stock** — but only those not already back. If a
manager has recorded a return with the "put them back on the shelf" tick, those units
are already counted, and cancelling adds only the rest. Otherwise the same goods would
be counted twice and the shop would offer what it does not have.

### 6.4 Stock

Stock is reserved at the moment of ordering — when the shopper presses "Go to payment",
before the bank's page. While they are paying, the goods are already theirs.

If there is less than the basket holds, no order is created: the shop shows how much is
left and the basket corrects the quantity itself.

**If no payment arrives within 30 minutes**, the reservation returns to stock and the
order is cancelled. A failed payment attempt does not release it: the shopper has five
attempts, and most often is simply reaching for another card.

Two shoppers can no longer buy the same last unit: the stock is decremented by a single
indivisible operation in the database, and whoever was slower sees a message with the
actual figure. That is the limitation the move to a database closed.

### 6.5 Delivery

Paid by the **recipient** at the branch, at the carrier's rates. The shop neither
computes nor displays that sum — it is not part of the order and depends on the
carrier's rates at the time of collection.

---

## 7. Security

| Measure | How it is done |
|---|---|
| Card details | **They never reach our server.** Payment happens on Monobank's side |
| Passwords | The shop does not store them — Supabase looks after them |
| Session | A cookie unreachable from JavaScript; signing out revokes it on Supabase's side |
| Two-factor sign-in | **Compulsory.** Until it is set up, the panel lets nobody anywhere except the Security page (§4.7) |
| Access | The role is checked on the server before a page is shown **and** in every request |
| Orders | There is no public address — only an administrator sees the details |
| Keys | Server-side only. Verified: they are absent from the code the browser downloads |
| Nova Poshta | Only three operations are exposed; arbitrary calls on the account's behalf are impossible |
| Brute force | Rate limits: sign-in 5/min per address, **and per account separately — 5 attempts/15 min and 20/day**; checkout 30 per 30 min; payment 5/min; 2FA code 10/min |
| Card testing | At most five payment attempts per order; the payment page opens only with a key issued at checkout |
| Payment amount | The bank reports a payment — the server checks the sum and the currency against its own figure. A message for a different sum does not close the order |
| Browser | Security headers: the site is not embedded in anybody else's iframe, and only our own scripts run |
| Journal | Sign-ins (failed ones included), changes to products, orders and the team are all recorded |

**Not yet done:** taking every account through 2FA enrolment (the code is ready, the
procedure itself remains) and an independent penetration test. Error reporting covers
server exceptions with no personal data: the user, cookies, headers, request body and
query string are stripped before anything is sent. Web analytics counts page views
without cookies and without IP addresses, so no individual shopper is visible in it.

### 7.1 The action journal

Who changed what, and when: sign-ins (failed ones included), changes to products,
orders and the team, confirmed payments and **payment mismatches**. Written
automatically, never edited, living in the database beside the orders.

To read it, use the "Journal" section in the panel. A manager sees what happened to
orders and their money; the owner sees sign-ins, account changes and IP addresses as
well. The reason: the journal records what managers did, and a control read by the
person being controlled is a weaker one — besides, it holds staff IP addresses and
emails.

Its most important case is money. If the bank reports a payment for a sum that does not
match ours, the order is deliberately **not** moved to "Paid", and the journal entry
remains the only trace that it happened at all.

The customer's payment letter exists and is sent from a verified domain. There is
**one** letter: news of the parcel comes from Nova Poshta.

---

## 8. Glossary

| Term | Meaning |
|---|---|
| **Catalogue** | The list of products available to a shopper |
| **Checkout** | The order placement page |
| **Waybill (TTN)** | The Nova Poshta consignment number used for tracking |
| **Badge** | A label on a product card |
| **Webhook** | The bank's message about a payment |
| **Basket in the browser** | Kept on the shopper's device, not on the server |
| **Soft delete** | A record is hidden but does not disappear, so history is not broken |