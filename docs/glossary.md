# Glossary

Agrosoy staff speak Spanish; the code speaks English. Use these names in code, database
tables and docs, and the Spanish column in the user interface.

## People and roles

| Spanish (UI)                      | English (code)     | Notes                                                             |
| --------------------------------- | ------------------ | ----------------------------------------------------------------- |
| Administrador / Administración    | `admin`            | Liz: accounting and administration. Sees and approves everything. |
| Gerente                           | `manager`          | Full read access and approvals.                                   |
| Técnico de venta                  | `sales_technician` | 10 people in 2 zones. Owns a customer portfolio.                  |
| Encargado de almacén / almacenero | `warehouse_keeper` | Records stock in and out of their warehouse.                      |
| Usuario                           | `user`             | One per person; nobody shares a login.                            |

## Sales and customers

| Spanish (UI)                    | English (code)                              | Notes                                                                                                  |
| ------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Cliente                         | `customer`                                  | Farmer or company that receives product.                                                               |
| Código de cliente               | `customer.code`                             | Assigned automatically by the system.                                                                  |
| Cartera                         | `portfolio`                                 | Customers assigned to a sales technician.                                                              |
| Zona                            | `zone`                                      | Sales area, e.g. Cuatro Cañadas. Configurable.                                                         |
| Propiedad                       | `property`                                  | A farm of the customer; a delivery may name one.                                                       |
| Persona autorizada (que recibe) | `authorized_receiver`                       | Name, CI and position or kinship; legal proof of receipt.                                              |
| Campaña (verano / invierno)     | `campaign` (`summer` / `winter`)            | Selling season with its own prices.                                                                    |
| Boleta                          | `delivery_note`                             | The key document. Three types below.                                                                   |
| Boleta de entrega               | `delivery_note` of type `delivery`          | Product leaves a warehouse to a customer.                                                              |
| Boleta de devolución            | `delivery_note` of type `return`            | Product comes back, against the original note and at its price.                                        |
| Boleta de traspaso              | `delivery_note` of type `campaign_transfer` | Unsettled consigned product moves to the next campaign at the new price. **Not** a warehouse transfer. |
| Contado / crédito               | `payment_terms`: `cash` / `credit`          | Cash notes record the payment in the same step.                                                        |
| Consignación                    | `consignment`                               | Product delivered that the customer may still return or carry over.                                    |
| Bonificación / muestra          | `free_of_charge` line (`bonus` / `sample`)  | Takes stock, creates no debt.                                                                          |
| Precio de referencia            | `reference_price`                           | Per campaign, zone and presentation; the technician records the negotiated price.                      |
| Número de factura (SIN)         | `tax_invoice_number`                        | Reference only; invoices are issued outside this system.                                               |

## Collections

| Spanish (UI)              | English (code)                                        | Notes                                                |
| ------------------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| Cobranza / pago           | `payment`                                             | Money (or goods) received from a customer.           |
| Medio de pago             | `payment_method`: `cash`, `transfer`, `qr`, `in_kind` | No cards.                                            |
| Pago en especie           | `in_kind` payment                                     | Soy, machinery or products, at an agreed value.      |
| Tipo de cambio            | `exchange_rate`                                       | Bolivianos per US dollar, stored on every operation. |
| Acuerdo de tipo de cambio | `exchange_rate_agreement`: `fixed` / `daily`          | Per customer.                                        |
| Cargo adicional (interés) | `charge`                                              | Added by administration with a reason.               |
| Recibo                    | `payment_receipt`                                     | PDF given for a payment.                             |
| Estado de cuenta          | `account_statement`                                   | Debt per customer, total and per campaign.           |
| Deuda / saldo             | `balance`                                             | Sum of the customer's ledger entries.                |
| Cancelado / debe          | `settled` / `owing`                                   | Status shown in the statement.                       |
| Antigüedad de la deuda    | `debt_aging`                                          | Age of unpaid deliveries.                            |

## Inventory and purchasing

| Spanish (UI)             | English (code)                                    | Notes                                                   |
| ------------------------ | ------------------------------------------------- | ------------------------------------------------------- |
| Almacén                  | `warehouse`                                       | Central, Cuatro Cañadas and Norte today; more later.    |
| Producto                 | `product`                                         | Has a code, a name and a line.                          |
| Línea                    | `product_line`: `agrochemicals` / `fertilizers`   | Needed for "ventas sin agroquímicos".                   |
| Presentación             | `presentation`                                    | Container with content and unit, e.g. 20 L can.         |
| Unidad de venta          | `sale_unit`: `per_unit_measure` / `per_container` | Price per liter or kilo, or per container.              |
| Lote / vencimiento       | `lot` / `expires_on`                              | Tracked per warehouse.                                  |
| Kardex                   | `stock_movement`                                  | Every stock change, with document, user and date.       |
| Traspaso entre almacenes | `warehouse_transfer`                              | Two steps: shipped by origin, received by destination.  |
| En tránsito              | `in_transit`                                      | Shipped but not yet received.                           |
| Conteo físico            | `stock_count`                                     | Blind count; differences become an approved adjustment. |
| Ajuste                   | `stock_adjustment`                                | The only manual stock change, approved with a reason.   |
| Proveedor / compra       | `supplier` / `purchase`                           | A purchase receives stock into the central warehouse.   |

## Travel allowances

| Spanish (UI)            | English (code)        | Notes                                           |
| ----------------------- | --------------------- | ----------------------------------------------- |
| Viáticos                | `travel_allowance`    | Money given to a technician for field expenses. |
| Gasto (con comprobante) | `travel_expense`      | Category plus receipt photo.                    |
| Saldo por rendir        | `unaccounted_balance` | Given minus spent.                              |

## Still to confirm with Agrosoy

| Term                   | Where it appears                              | Question                                                                                  |
| ---------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| MP, SV, Agrosoil       | "Observación" column of the sales spreadsheet | What does each mean? SV rows have price 0 (free of charge?). Is Agrosoil another company? |
| "El caso de intereses" | Meeting, 04:16                                | Do they charge late-payment interest, and how?                                            |
| Closing a consignment  | Meeting, 04:33                                | What closes a consigned delivery: payment, a confirmation, or the end of the campaign?    |
| Note numbering         | Paper pad                                     | Do delivery, return and transfer notes share one number sequence?                         |
