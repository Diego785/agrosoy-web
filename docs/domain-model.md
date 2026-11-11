# Domain model

How Agrosoil's business works in this system. Read this before touching sales, collections or
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
5. **Every operation stores its own exchange rate, once it is agreed.** Prices and debt are in US
   dollars; the rate agreed for that operation is kept with it so bolivianos can always be
   reconstructed. A credit note can leave it for the payment (D35); a payment always has one.
6. **Every command has an author.** Each write records user, date and time in the audit log.

## Modules

| #   | Module                    | Code folder                  | Owns                                                                       |
| --- | ------------------------- | ---------------------------- | -------------------------------------------------------------------------- |
| M1  | Users, roles and audit    | `identity`, `shared/audit`   | users, sessions, role permissions, audit log                               |
| M2  | Customers and portfolio   | `customers`                  | customers, zones, properties, authorized receivers, technician assignments |
| M3  | Products and prices       | `catalog`                    | products, presentations, lots, reference prices                            |
| M4  | Campaigns                 | `campaigns`                  | campaigns and their closing summary                                        |
| M5  | Delivery notes            | `sales`                      | delivery, return and campaign-transfer notes, numbering, PDF               |
| M6  | Collections               | `collections`                | payments, allocations, charges, receipts                                   |
| M7  | Account statement         | `receivables`                | the customer ledger and statements                                         |
| M8  | Inventory                 | `inventory`                  | warehouses, stock movements, stock balances, transfers, counts             |
| M9  | Purchasing                | `purchasing`                 | suppliers, purchases                                                       |
| M10 | Travel allowances         | `travel-allowances`          | weekly expense reports, approvals, monthly limits, vehicles                |
| M11 | Reports and notifications | `reporting`, `notifications` | read models, exports, alerts                                               |
| M12 | Migration                 | `migration`                  | spreadsheet import, review findings, statement preview                     |

Modules change each other's data only through their `application` layer (use cases and ports),
never by writing another module's tables. Read models may join across modules (the customer list
shows the technician's name) and foreign keys may point across them. M5 is the main orchestrator: confirming a note calls
inventory (M8) and receivables (M7) inside one transaction.

## Users (M1)

- One user per person with a role; permissions per role are editable by administration.
- Optional **position** ("Ejecutivo de ventas") and **CI**, printed on notes, receipts and travel
  reports (D26), and for technicians a **zone of work** (D30).

## Customers (M2)

- **Customer:** automatic `code` (a number shown as 0042; searching "42" also finds it), name,
  NIT or CI, phone, zone (Agrosoil works with two, Norte and Este), locality (the technician's own
  area within the zone, optional), properties, assigned technician, exchange-rate agreement
  (`fixed` with its rate, or `daily`; a database check keeps the two consistent), active flag.
- Administration and management edit customers; every role can look them up, and technicians see
  their own portfolio first.
- Names are unique after normalization (case, accents and spacing ignored; ñ kept), so the
  spreadsheet's "Proan K Rapid" / "Proan k rapid" kind of duplicate can't happen. Namesakes are
  told apart in the name itself.
- **Portfolio:** a customer has one technician at a time. Changing it keeps the history
  (assignments have a start and end date); past documents keep the technician they had.
- **Authorized receivers:** name, CI and position or kinship. A delivery records who received.
- **Import (D29):** Agrosoil's customer list is loaded into a preview, matched by normalized name,
  and saved once reviewed; nothing is created twice.

## Products and prices (M3)

- **Product:** name and line (`agrochemicals` or `fertilizers`); it groups its presentations.
- **Presentation (D23):** Agrosoil's **code** ("001"), content and unit (20 L, 250 ml, 25 kg, 50
  units…) and sale unit: the price is either per liter/kilo or per container (frasco, bolsa,
  sobre). Each note line knows its total liters or kilos.
- Products and presentations no longer sold are deactivated, never deleted.
- **Lot:** lot number and expiry date. Stock is held per warehouse **and lot**.
- **Reference price:** US dollars per sale unit, per campaign × zone × presentation, with a
  general price (no zone) used where a zone has none. Agrosoil enters them when a campaign starts;
  the product list's prices load as the general ones. The technician records the negotiated price
  on each line; the reference is a suggestion.
- **Catalog import (D23):** Agrosoil's product list (code, name with the container in brackets,
  price, price unit) is read into a preview that groups presentations under their product and
  flags what needs a decision; its "OTROS" rows are charge concepts, not products (D24).
- Products are picked from the catalog, never typed, so each product has exactly one name.

## Campaigns (M4)

- `summer` or `winter` plus year, with start and end dates (its sales period; campaigns never
  overlap); one is the current campaign.
- Every note, payment and ledger entry belongs to the campaign its date falls in, which gives the
  per-campaign breakdown of debt.
- **Due date (D37):** when the campaign's debt has to be paid, 30 November for winter and 31 May of
  the next year for summer by default; administration can move it, and can give one customer a
  later date for one campaign (an extension, with a reason). Past it, what is still owed in that
  campaign is **overdue**.
- **Late-payment interest (D38):** each time a due date plus the days administration sets passes,
  the system proposes 3 % of each customer's unpaid balance in that campaign and earlier ones
  (earlier interest left out); administration confirms the charges.
- **Closing** a campaign produces its summary (sales, collected, pending debt, consigned product)
  and blocks new documents dated in it, except campaign transfers out of it.

## Delivery notes (M5)

A note has a header and lines.

- **Header:** number, type, date, customer, property, campaign, technician, warehouse, payment
  terms (`cash` / `credit`), agreed exchange rate (optional on credit, D35), receiver (name, CI,
  position or kinship),
  person who hands over (name, position, CI), carrier (company, vehicle, CI), observations,
  optional SIN invoice number (administration can add it after confirming, also one number to
  several notes, D40), photo of the signed paper copy.
- **PDF (D26):** printed like the paper form, one layout for the three types with the type's box
  checked.
- **Historical notes (D29):** paper notes dated before the cut-off date, typed with their printed
  number; they post their debt but never move stock.
- **Line:** presentation, lot, quantity, unit price in USD, line total, and a free-of-charge flag
  with its reason (`bonus` or `sample`). A free line keeps its unit price as its commercial value
  and totals 0 (D41).
- **States:** `draft` → `confirmed` → `voided` (with reason). Only drafts can be edited.
- **Numbering (D19, D28):** one gapless counter, shared by the three types, given on confirmation.
  Paper notes typed in later keep their printed number; the counter skips numbers already taken and
  a repeated number is rejected. Administration sets where the counter starts: the system's own
  numbers go in a range the paper pads won't reach.

### What confirming a note does

| Note type                         | Stock (M8)                                    | Customer ledger (M7)                                                                            |
| --------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Delivery, credit                  | − quantity from warehouse + lot               | **debit** total, in the note's campaign                                                         |
| Delivery, cash                    | − quantity from warehouse + lot               | **debit** total and **credit** the payment recorded in the same step                            |
| Delivery, free-of-charge line     | − quantity                                    | nothing for that line                                                                           |
| Return (against an original note) | + quantity to the warehouse                   | **credit** quantity × the original line's price                                                 |
| Campaign transfer                 | nothing (the product stays with the customer) | **credit** in the old campaign at the old price, **debit** in the new campaign at the new price |
| Void of any of the above          | the exact reverse movements                   | the exact reverse entries                                                                       |

Rules:

- A delivery cannot take more than the warehouse + lot has, and warns when the lot is expired.
- Returns and campaign transfers take lines from confirmed delivery notes of the same customer and
  campaign (D25; the week 3 build still takes them from a single note) and are saved already
  confirmed (with their number, or the printed one). Each line can be returned or transferred only
  up to what is left of it: delivered minus what confirmed returns and transfers already took.
  This is the customer's consigned quantity of that delivery.
- A return is credited in the original note's campaign, dated the day of the return.
- A transfer is dated in the new campaign (a different, open one); it credits the old campaign at
  the delivered price and charges the new one at the new price (suggested from the new
  campaign's reference prices). Free lines owe nothing, so they are not transferred.
- A delivery note with confirmed returns or transfers is voided only after them.

## Collections (M6)

- **Payment:** date, customer, amount, currency (`USD` or `BOB`), exchange rate, USD equivalent,
  method (`cash`, `transfer`, `qr`, `in_kind` with description and agreed value), reference,
  receipt number (the next one, or the printed one of a paper receipt, D28).
- **Allocation (D20):** a payment is applied to a specific note, to a campaign, or by default to
  the oldest debt first (campaigns in order of their start). What is left after every campaign is
  settled stays as a credit in favor in the campaign of the payment date. Each allocation is a
  **credit** entry in that campaign.
- **Receipt (D19, D26, D27):** its own counter; printed like the paper receipt, with the amount in
  words, the concept, and the customer's balance before and after the payment as it was when it
  was recorded.
- **Cash note:** confirming it records its payment at once, in the currency paid, for exactly the
  note's total (in bolivianos: total × the note's rate). Voiding the note voids that payment.
- **Exchange rate (D36):** suggested from the customer's fixed rate or, without one, the rate in
  force: the last one administration recorded, typed or taken from the official rate. With
  "Seguir el oficial" on, the official rate becomes the rate in force each day (D42).
- **Charge (D24):** entered by administration with a concept (interest, price adjustment,
  notarized contract, legal fees, other) and a reason, in an open campaign. A price adjustment can
  also lower the debt. Interest also comes from the proposals of D38. Payments and charges are
  voided with a reason, never deleted.
- **Who records payments:** administration only. It checks that a transfer arrived and that cash
  reached the office before recording them (meeting of 7 November 2026).
- A payment in bolivianos stores both amounts: `usd = bob ÷ rate`, rounded half up to the cent.

## Receivables ledger and statement (M7)

The **ledger** is an append-only table of entries:

| Field              | Meaning                                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| customer, campaign | whose debt and in which season                                                                                         |
| date               | business date of the operation (Bolivia time)                                                                          |
| kind               | `delivery`, `return`, `payment`, `charge`, `campaign_transfer_out`, `campaign_transfer_in`, `opening_balance`          |
| amount (USD)       | positive = debit (they owe more), negative = credit (they owe less)                                                    |
| source             | the document that produced it (note, payment, charge, migration batch)                                                 |
| reverses           | on the entries a void writes: the entry they cancel. They keep its kind, so a voided delivery nets out of "deliveries" |

- **Balance** of a customer = sum of amounts; per campaign = sum filtered by campaign.
- The **statement** keeps the columns Agrosoil uses today: deliveries, payments, returns, balance,
  and status `settled` (balance 0 or in favor) or `owing`, per campaign and in total, plus the
  dated detail (each note line, receipt and charge) and the consigned product. Charges, opening
  balances and campaign transfers add an "others" column only when there are any. Voided
  documents stay in the detail with their cancelling line and net out of their own column.
- In the detail, each payment shows its amount in bolivianos with its rate (D39) and each note its
  invoice number, when it has one (D40). Next to the total, the statement shows what is overdue
  (D37).
- **Aging** pairs credits with the oldest debits (first in, first out) and reports the age of
  what is still unpaid in buckets of 30, 60, 90 and more than 90 days; voided documents and their
  reversals are left out of the pairing. The portfolio shows each customer's debt older than 90
  days and what is overdue (D37). Technicians open the portfolio on their own customers and can
  switch to everyone's.
- Every technician can see any statement; only administration writes payments and charges.

## Inventory (M8)

- **Warehouses:** the large ones are Cuatro Cañadas (zona este) and San Pedro (zona norte); San
  Pablo and Chiquitos are small, with a keeper who is the only one taking product; Yapacaní will get
  its own. Product moves between them often (meeting of 7 November 2026); the list is confirmed when
  week 4 starts.
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
- **Withdrawal (D44, settled in week 4):** whoever takes product out of a warehouse records it; the
  product is held by the technician until delivery notes cover it or it comes back, and the keeper
  confirms each withdrawal from their warehouse.
- Every stock change comes from a document: note, purchase, transfer, withdrawal or approved
  adjustment.
- Agrosoil uses one paper "traspaso" form for both moves; in the system a **warehouse transfer**
  and a **campaign transfer** (M5) are different documents with different names.

## Purchasing (M9)

- **Supplier** and **purchase:** date, lines (presentation, lot, expiry, quantity, USD price),
  exchange rate, terms (`cash` / `credit`). Receiving it creates `purchase_receipt` movements in
  the central warehouse. Accounts payable are out of scope.

## Travel allowances (M10)

Modeled on Agrosoil's weekly expense spreadsheet (D30). Amounts in bolivianos.

- **Expense report:** one per technician and week (Monday to Saturday), with position and zone of
  work. States: `draft` → `submitted` (technician) → `approved` (management) → `paid`
  (administration); only drafts are edited.
- **Expense:** date, category (`fuel`, `lodging`, `food`, `tolls`, `entertainment`,
  `vehicle_repairs`, `vehicle_accessories`, `other`), amount, invoice control code, observation,
  optional receipt photo. Fuel records the odometer; food is entered per day; entertainment says
  what it was for. Vehicle costs say who paid: the technician or the company.
- **Result:** subtotal of what the technician paid minus the **cash advanced** = amount reimbursed
  (positive) or returned (negative).
- **Monthly limit** per technician (Bs 4,800 by default): the month's total and the difference.
- **Vehicle:** plate or name and person in charge; its maintenance and accessories add up per
  month, whoever paid them.
- Documents: the weekly report as a PDF to sign, the monthly summary per category and week, and
  the monthly cost per vehicle.

## Notifications (M11)

In-app and by email to the people responsible: lots expiring in 30, 60 and 90 days, stock below
minimum, transfers unconfirmed for 3 days, customers with overdue debt (D37).

## Storage conventions

| Kind of value             | Postgres type                      | TypeScript                            |
| ------------------------- | ---------------------------------- | ------------------------------------- |
| Money (USD or BOB)        | `numeric(14,2)`                    | `Money` (integer cents)               |
| Quantity                  | `numeric(12,3)`                    | `Quantity` (integer thousandths)      |
| Exchange rate             | `numeric(10,4)`                    | `ExchangeRate`                        |
| Business date             | `date`                             | ISO string `YYYY-MM-DD`, Bolivia time |
| Moment something happened | `timestamptz`                      | `Date`                                |
| Identifier                | `uuid`                             | `string`                              |
| Human document number     | `integer` with a unique constraint | `number`                              |

Column names are `snake_case` in the database and `camelCase` in TypeScript (Drizzle maps them).

## Migration (M12)

**Going live (D29, D43).** Agrosoil's administration fills its full sales spreadsheets in the
current format and imports and converts them itself; that is the main way in. Customers and
products come through imports with a preview. For debt without a sheet, administration enters an
opening balance per customer and campaign, historical notes only for product still on consignment,
and historical payments with their printed receipt numbers.

**Import (built in week 1).** An administrator uploads a technician's workbook on the import page.
Each sheet with a sales table becomes an _import batch_ (D17):

- The sales table, the returns table ("DEVOLUCIONES") and the per-customer summary (Entrega,
  Pago, Dev., Deuda) are found by their header text, so other technicians' sheets with shifted
  columns read the same way.
- Line totals are recomputed as quantity × price; the sheet's own totals are only compared.
- Payments come from the summary's "Pago" column and have no date. Summary names are matched to
  the sales lines even when shortened ("ANDRES KAORU" → "Andres Kaoru Matsudo").
- Findings for administration: sales with no exchange rate (normal for customers whose rate is
  agreed at payment, D35), zero prices, a "Total" formula that leaves
  rows out, a note number reused on different dates, customers missing from the summary, summary
  totals that differ from the lines, rounded or unreadable values.
- The account-statement preview reads these batches and renders with the same components the
  ledger-based statement (M7) will use.

**Conversion (weeks 2–3), on the "Pasar al sistema" page of each sheet, in three steps:**

1. Customers are registered (with the technician the sheet's name suggests).
2. Products and presentations are created once administration chooses their line and how they
   are charged.
3. Sales and payments (D22): each sale (customer + written number + date) becomes a confirmed
   delivery note marked imported, keeping the sheet's number apart from the system's numbering;
   the returns table (or the summary's "Dev.") and the summary's payments become ledger entries
   of the import batch, dated on a cut-off date chosen by administration because the sheet
   doesn't date them: the day the sheet was last updated (D43). A sale with a blank rate stays
   without one (D35). Everything goes to the campaign chosen for the sheet, and each note takes its
   customer's technician. While a customer or product of the sheet is missing, the sales can't be
   passed (D43; until then such rows were skipped and listed, never guessed). Imported notes post
   ledger entries but **no** stock movements, and can later take returns and transfers.

- Converting sales is undone by voiding the imported notes and reversing the batch's entries;
  only then can the sheet be imported again.
- The reconciliation compares, per customer, the debt the sheet computes (lines recomputed,
  payments and returns from the summary) with what the conversion recorded, and lists the skipped
  rows. With the real `ventas.xlsx` and all products converted, the 15 customers match exactly
  (US$ 31.932,00). The sheet's own "Total" formula leaves out its last two rows (US$ 1.920), which
  the review page reports as a finding.
- When a campaign's detail can't be reconstructed, the customer gets one `opening_balance` entry
  for it instead (not built yet; no sheet has needed it).
- Stock starts from a physical count per warehouse and lot (`opening` movements), not from the
  spreadsheets.
