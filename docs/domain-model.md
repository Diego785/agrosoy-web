# Domain model

How Agrosoy's business works in this system. Read this before touching sales, collections or
inventory code. Terms follow the [glossary](glossary.md); the reasons behind the design are in
[decisions](decisions.md).

## Principles

1. **Nothing is deleted or edited after it counts.** A confirmed document is voided with a reason,
   and voiding writes reversing entries. History always adds up.
2. **Balances are derived, never typed.** Customer debt is the sum of ledger entries; stock is the
   sum of stock movements. Nobody edits a balance by hand.
3. **One document, one transaction.** Confirming a delivery note takes the stock, charges the debt
   and records the audit entry together, or none of it happens.
4. **Money is exact.** Amounts are integer cents (`Money`), quantities are integer thousandths
   (`Quantity`), exchange rates have four decimals (`ExchangeRate`). No floating point.
5. **Every operation stores its own exchange rate.** Prices and debt are in US dollars; the rate
   agreed for that operation is kept with it so bolivianos can always be reconstructed.
6. **Every command has an author.** Each write records user, date and time in the audit log.

## Modules

| # | Module | Code folder | Owns |
|---|---|---|---|
| M1 | Users, roles and audit | `identity`, `shared/audit` | users, sessions, role permissions, audit log |
| M2 | Customers and portfolio | `customers` | customers, zones, properties, authorized receivers, technician assignments |
| M3 | Products and prices | `catalog` | products, presentations, lots, reference prices |
| M4 | Campaigns | `campaigns` | campaigns and their closing summary |
| M5 | Delivery notes | `sales` | delivery, return and campaign-transfer notes, numbering, PDF |
| M6 | Collections | `collections` | payments, allocations, charges, receipts |
| M7 | Account statement | `receivables` | the customer ledger and statements |
| M8 | Inventory | `inventory` | warehouses, stock movements, stock balances, transfers, counts |
| M9 | Purchasing | `purchasing` | suppliers, purchases |
| M10 | Travel allowances | `travel-allowances` | advances and expenses per technician |
| M11 | Reports and notifications | `reporting`, `notifications` | read models, exports, alerts |
| M12 | Migration | `scripts/migration` | spreadsheet import and reconciliation |

Modules talk to each other only through their `application` layer (use cases and ports), never
by reaching into another module's tables. M5 is the main orchestrator: confirming a note calls
inventory (M8) and receivables (M7) inside one transaction.

## Customers (M2)

- **Customer:** automatic `code`, name, NIT or CI, phone, zone, properties, assigned technician,
  exchange-rate agreement (`fixed` with its rate, or `daily`), active flag.
- Names are unique after normalization (case, accents and spacing ignored; ñ kept), so the
  spreadsheet's "Proan K Rapid" / "Proan k rapid" kind of duplicate can't happen. Namesakes are
  told apart in the name itself.
- **Portfolio:** a customer has one technician at a time. Changing it keeps the history
  (assignments have a start and end date); past documents keep the technician they had.
- **Authorized receivers:** name, CI and position or kinship. A delivery records who received.

## Products and prices (M3)

- **Product:** code, name, line (`agrochemicals` or `fertilizers`).
- **Presentation:** content and unit (20 L, 250 ml, 25 kg…) and sale unit: the price is either
  per liter/kilo or per container. Each note line knows its total liters or kilos.
- **Lot:** lot number and expiry date. Stock is held per warehouse **and lot**.
- **Reference price:** US dollars per sale unit, per campaign × zone × presentation. The
  technician records the negotiated price on each line; the reference is a suggestion.
- Products are picked from the catalog, never typed, so each product has exactly one name.

## Campaigns (M4)

- `summer` or `winter` plus year, with start and end dates; one is the current campaign.
- Every note, payment and ledger entry belongs to a campaign, which gives the per-campaign
  breakdown of debt.
- **Closing** a campaign produces its summary (sales, collected, pending debt, consigned product)
  and blocks new documents dated in it, except campaign transfers out of it.

## Delivery notes (M5)

A note has a header and lines.

- **Header:** number, type, date, customer, property, campaign, technician, warehouse, payment
  terms (`cash` / `credit`), agreed exchange rate, receiver (name, CI, position or kinship),
  observations, optional SIN invoice number, photo of the signed paper copy.
- **Line:** presentation, lot, quantity, unit price in USD, line total, and a free-of-charge flag
  with its reason (`bonus` or `sample`, price 0).
- **States:** `draft` → `confirmed` → `voided` (with reason). Only drafts can be edited.
- **Numbering:** one gapless counter that continues the paper pad. Paper notes typed in later keep
  their printed number; the system rejects a number that already exists. (Whether the three types
  share the counter is still to confirm; see the glossary.)

### What confirming a note does

| Note type | Stock (M8) | Customer ledger (M7) |
|---|---|---|
| Delivery, credit | − quantity from warehouse + lot | **debit** total, in the note's campaign |
| Delivery, cash | − quantity from warehouse + lot | **debit** total and **credit** the payment recorded in the same step |
| Delivery, free-of-charge line | − quantity | nothing for that line |
| Return (against an original note) | + quantity to the warehouse | **credit** quantity × the original line's price |
| Campaign transfer | nothing (the product stays with the customer) | **credit** in the old campaign at the old price, **debit** in the new campaign at the new price |
| Void of any of the above | the exact reverse movements | the exact reverse entries |

Rules:

- A delivery cannot take more than the warehouse + lot has, and warns when the lot is expired.
- A return cannot exceed what that note delivered minus what was already returned.
- A campaign transfer cannot exceed the customer's consigned quantity in the old campaign.

## Collections (M6)

- **Payment:** date, customer, amount, currency (`USD` or `BOB`), exchange rate, USD equivalent,
  method (`cash`, `transfer`, `qr`, `in_kind` with description and agreed value), reference,
  receipt number.
- **Allocation:** a payment is applied to a specific note, to a campaign, or by default to the
  oldest debt first. Each allocation is a **credit** entry in that campaign.
- **Exchange rate:** suggested from the customer's agreement; administration records the day's
  rate when the agreement is `daily`.
- **Charge:** an extra debit (for example interest) entered by administration with a reason.
- A payment in bolivianos stores both amounts: `usd = bob ÷ rate`, rounded half up to the cent.

## Receivables ledger and statement (M7)

The **ledger** is an append-only table of entries:

| Field | Meaning |
|---|---|
| customer, campaign | whose debt and in which season |
| date | business date of the operation (Bolivia time) |
| kind | `delivery`, `return`, `payment`, `charge`, `campaign_transfer_out`, `campaign_transfer_in`, `opening_balance`, `reversal` |
| amount (USD) | positive = debit (they owe more), negative = credit (they owe less) |
| source | the document that produced it (note, payment, charge, migration batch) |

- **Balance** of a customer = sum of amounts; per campaign = sum filtered by campaign.
- The **statement** keeps the columns Agrosoy uses today: deliveries, payments, returns, balance,
  and status `settled` (balance 0) or `owing`, per campaign and in total, plus the dated detail
  and the consigned product.
- **Aging** pairs credits with the oldest debits (first in, first out) and reports the age of
  what is still unpaid.
- Every technician can see any statement; only administration writes payments and charges.

## Inventory (M8)

- **Stock movements** (the kardex) are append-only: warehouse, lot, signed quantity, kind
  (`purchase_receipt`, `delivery`, `return`, `transfer_out`, `transfer_in`, `count_adjustment`,
  `opening`), source document, user and time.
- **Stock balances** per warehouse + lot are a projection updated in the same transaction as the
  movement, with a database check that the quantity is never negative. That check, not
  application code, is what stops two people from selling the same last can at once.
- **Warehouse transfer:** the origin ships (`transfer_out`, product shows as in transit), the
  destination receives (`transfer_in`) and reports differences. Unconfirmed after 3 days → alert.
- **Stock count:** administration opens a count; the keeper enters what is physically there
  without seeing the system quantity; differences are approved with a reason and become a
  `count_adjustment`.
- Every stock change comes from a document: note, purchase, transfer or approved adjustment.

## Purchasing (M9)

- **Supplier** and **purchase:** date, lines (presentation, lot, expiry, quantity, USD price),
  exchange rate, terms (`cash` / `credit`). Receiving it creates `purchase_receipt` movements in
  the central warehouse. Accounts payable are out of scope.

## Travel allowances (M10)

- **Advance:** money given to a technician. **Expense:** date, category (fuel, lodging, food,
  tolls, entertainment, vehicle repairs and accessories), amount, receipt photo.
- Unaccounted balance = advances − expenses, per technician.

## Notifications (M11)

In-app and by email to the people responsible: lots expiring in 30, 60 and 90 days, stock below
minimum, transfers unconfirmed for 3 days, customers with debt older than 90 days.

## Storage conventions

| Kind of value | Postgres type | TypeScript |
|---|---|---|
| Money (USD or BOB) | `numeric(14,2)` | `Money` (integer cents) |
| Quantity | `numeric(12,3)` | `Quantity` (integer thousandths) |
| Exchange rate | `numeric(10,4)` | `ExchangeRate` |
| Business date | `date` | ISO string `YYYY-MM-DD`, Bolivia time |
| Moment something happened | `timestamptz` | `Date` |
| Identifier | `uuid` | `string` |
| Human document number | `integer` with a unique constraint | `number` |

Column names are `snake_case` in the database and `camelCase` in TypeScript (Drizzle maps them).

## Migration (M12)

- Customers and products are normalized and receive codes.
- Spreadsheet sales rows become confirmed notes marked `imported`, with their original numbers,
  and spreadsheet payments become payments, so statements show real dated detail. Imported
  notes post ledger entries but **no** stock movements.
- When a campaign's detail can't be reconstructed, the customer gets one `opening_balance` entry
  for it instead.
- Stock starts from a physical count per warehouse and lot (`opening` movements), not from the
  spreadsheets.
- a reconciliation report compares each customer's debt with the spreadsheet. The current sales
  sheet's total formula leaves out its last two rows (US$ 1.920), so differences are expected and
  must be explained to administration before go-live.
