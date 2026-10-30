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
| Cargo                             | `user.position`    | Printed on documents, e.g. "Ejecutivo de ventas" (D26).           |
| Zona de trabajo                   | `user.work_zone`   | A technician's zone, shown on travel-allowance reports (D30).     |

## Sales and customers

| Spanish (UI)                    | English (code)                              | Notes                                                                                                  |
| ------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Cliente                         | `customer`                                  | Farmer or company that receives product.                                                               |
| Código de cliente               | `customer.code`                             | Assigned automatically by the system.                                                                  |
| Cartera                         | `portfolio`                                 | Customers assigned to a sales technician.                                                              |
| Zona                            | `zone`                                      | Sales area, e.g. Cuatro Cañadas. Configurable.                                                         |
| Propiedad / hacienda ("Hac.")   | `property`                                  | A farm of the customer; a delivery may name one.                                                       |
| Persona autorizada (que recibe) | `authorized_receiver`                       | Name, CI and position or kinship; legal proof of receipt.                                              |
| Persona que entrega             | `handed_over_by`                            | Name, position and CI of who hands the product over (D26).                                             |
| Transportista                   | `carrier`                                   | Company, vehicle and CI of the driver, printed on the note (D26).                                      |
| Campaña (verano / invierno)     | `campaign` (`summer` / `winter`)            | Selling season with its own prices.                                                                    |
| Boleta                          | `delivery_note`                             | The key document. Three types below, on one paper form and one number sequence.                        |
| Boleta de entrega               | `delivery_note` of type `delivery`          | Product leaves a warehouse to a customer.                                                              |
| Boleta de devolución            | `delivery_note` of type `return`            | Product comes back, against lines of earlier deliveries and at their price (D25).                      |
| Boleta de traspaso              | `delivery_note` of type `campaign_transfer` | Unsettled consigned product moves to the next campaign at the new price. **Not** a warehouse transfer. |
| Talonario                       | `paper_pad`                                 | Printed, numbered pad still used in the field; its numbers are typed in as printed (D28).              |
| Boleta antigua                  | `historical_note`                           | A paper note from before the cut-off date, typed in; it never moves stock (D29).                       |
| Saldo inicial                   | `opening_balance`                           | Debt carried in per customer and campaign at go-live (D29).                                            |
| Fecha de corte                  | `cutoff_date`                               | The day the system starts; earlier notes don't move stock (D29).                                       |
| Contado / crédito               | `payment_terms`: `cash` / `credit`          | Cash notes record the payment in the same step.                                                        |
| Consignación                    | `consignment`                               | Product delivered that the customer may still return or carry over.                                    |
| Bonificación / muestra          | `free_of_charge` line (`bonus` / `sample`)  | Takes stock, creates no debt.                                                                          |
| Precio de referencia            | `reference_price`                           | Per campaign, zone and presentation; the technician records the negotiated price.                      |
| Número de factura (SIN)         | `tax_invoice_number`                        | Reference only; invoices are issued outside this system.                                               |
| Datos de la empresa             | `company_profile`                           | Name, logo and contacts printed on every document: Agrosoil Bolivia (D26).                             |

## Collections

| Spanish (UI)              | English (code)                                                                  | Notes                                                      |
| ------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Cobranza / pago           | `payment`                                                                       | Money (or goods) received from a customer.                 |
| Medio de pago             | `payment_method`: `cash`, `transfer`, `qr`, `in_kind`                           | No cards.                                                  |
| Pago en especie           | `in_kind` payment                                                               | Soy, machinery or products, at an agreed value.            |
| Tipo de cambio            | `exchange_rate`                                                                 | Bolivianos per US dollar, stored on every operation.       |
| Acuerdo de tipo de cambio | `exchange_rate_agreement`: `fixed` / `daily`                                    | Per customer.                                              |
| Cargo adicional           | `charge`                                                                        | Added by administration with a concept and a reason (D24). |
| Concepto del cargo        | `charge_concept`: `interest`, `price_adjustment`, `notarized_contract`, `other` | Codes 079, 080 and 081 of Agrosoy's list.                  |
| Recibo                    | `payment_receipt`                                                               | PDF given for a payment, like the paper receipt (D26).     |
| Total / a cuenta / saldo  | `balance_before` / payment amount / `balance_after`                             | Kept as they were when the receipt was issued (D27).       |
| Estado de cuenta          | `account_statement`                                                             | Debt per customer, total and per campaign.                 |
| Deuda / saldo             | `balance`                                                                       | Sum of the customer's ledger entries.                      |
| Cancelado / debe          | `settled` / `owing`                                                             | Status shown in the statement.                             |
| Antigüedad de la deuda    | `debt_aging`                                                                    | Age of unpaid deliveries.                                  |

## Inventory and purchasing

| Spanish (UI)             | English (code)                                    | Notes                                                             |
| ------------------------ | ------------------------------------------------- | ----------------------------------------------------------------- |
| Almacén                  | `warehouse`                                       | Central, Cuatro Cañadas and Norte today; more later.              |
| Producto                 | `product`                                         | Has a name and a line; groups its presentations.                  |
| Código de producto       | `presentation.code`                               | Agrosoy's code, one per container: "001" Fulvin 40-22 20 L (D23). |
| Línea                    | `product_line`: `agrochemicals` / `fertilizers`   | Needed for "ventas sin agroquímicos".                             |
| Presentación             | `presentation`                                    | Container with content and unit, e.g. 20 L can, 50-unit bag.      |
| Unidad de venta          | `sale_unit`: `per_unit_measure` / `per_container` | Price per liter or kilo, or per container (frasco, bolsa, sobre). |
| Lote / vencimiento       | `lot` / `expires_on`                              | Tracked per warehouse.                                            |
| Kardex                   | `stock_movement`                                  | Every stock change, with document, user and date.                 |
| Traspaso entre almacenes | `warehouse_transfer`                              | Two steps: shipped by origin, received by destination.            |
| En tránsito              | `in_transit`                                      | Shipped but not yet received.                                     |
| Conteo físico            | `stock_count`                                     | Blind count; differences become an approved adjustment.           |
| Ajuste                   | `stock_adjustment`                                | The only manual stock change, approved with a reason.             |
| Proveedor / compra       | `supplier` / `purchase`                           | A purchase receives stock into the central warehouse.             |

## Travel allowances

| Spanish (UI)                    | English (code)                                                                                         | Notes                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Informe de viáticos (semanal)   | `expense_report`                                                                                       | One per technician and week, Monday to Saturday (D30).                                                                                             |
| Gasto                           | `travel_expense`                                                                                       | Date, amount in Bs, control code, observation, photo.                                                                                              |
| Categoría                       | `fuel`, `lodging`, `food`, `tolls`, `entertainment`, `vehicle_repairs`, `vehicle_accessories`, `other` | Combustible, hospedaje, alimentación, tasa de rodaje/peaje, gastos de representación, mantenimiento y reparaciones, accesorios de vehículo, otros. |
| Código de control               | `control_code`                                                                                         | The invoice's control code.                                                                                                                        |
| Kilometraje actual              | `odometer`                                                                                             | Recorded with fuel.                                                                                                                                |
| Monto viáticos / Agrosoil       | `paid_by`: `technician` / `company`                                                                    | Who paid a vehicle cost.                                                                                                                           |
| Efectivo adelantado             | `cash_advance`                                                                                         | Subtracted from the report's subtotal.                                                                                                             |
| Límite mensual                  | `monthly_limit`                                                                                        | Per technician, Bs 4,800 by default.                                                                                                               |
| Aprobado / revisado y cancelado | `approved` / `paid`                                                                                    | The report's last two states.                                                                                                                      |
| Vehículo / encargado            | `vehicle` / `person_in_charge`                                                                         | Maintenance and accessories add up per vehicle and month.                                                                                          |

## Still to confirm with Agrosoy

| Term                  | Where it appears                              | Question                                                                                                                       |
| --------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| MP, SV, Agrosoil      | "Observación" column of the sales spreadsheet | What do MP and SV mean? SV rows have price 0 (free of charge?). Agrosoil is the brand on their forms; what marks it in a sale? |
| Closing a consignment | Meeting, 04:33                                | What closes a consigned delivery: payment, a confirmation, or the end of the campaign?                                         |

Answered on 28 Oct 2026: the three note types share one paper form and number sequence (D19); they
charge interest, as a concept with its own code (D24).
