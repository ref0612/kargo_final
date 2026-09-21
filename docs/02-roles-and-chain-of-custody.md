# Roles and Chain of Custody (v2, after the consultant review)

## Organizational levels
1. **Client**: Merchant
2. **Kargo**: Coordinator / Control Tower (includes the KAM and the network admin), Audit / Reconciliation, Finance
3. **Transport Operator** (carrier) with internal roles

## Roles
| Role | Level | Responsibility | Scans | Signs |
|---|---|---|---|---|
| Merchant | Client | Creates the order, prints and sticks the labels. Read-only tracking. | — | — |
| Coordinator / Control Tower | Kargo | Assigns orders to an operator (choosing the last-mile modality), watches the KPIs, registers merchants (KAM), imports operators from Konnect, resolves incidents. | — | — |
| Audit / Reconciliation | Kargo | Read-only over everything: counts per checkpoint, incident cases, event log. Can close a case with a note. | — | — |
| Finance | Kargo | Read-only: shipments by client and period, CSV export. No prices yet. | — | — |
| Dispatcher | Operator | Accepts or rejects the assignment, designates pickup driver + vehicle, designates the last-mile driver. | — | — |
| Pickup Driver | Operator | At the merchant warehouse: may adjust the box count (reason required) and print new labels, scans every package, gets the signature. | Every package | Yes (origin) |
| Warehouse Clerk (WH1) | Operator | Scans origin hub intake, assigns the bus (timetable suggestion, 2 h window), scans destination hub intake, and for "recipient pickup" marks ready and delivers (scan + signature). | Every package | Yes (only in recipient pickup) |
| Bus Driver / Assistant | Operator | Scans loading onto the bus. Unloading is NOT scanned (out of scope). | Every package | — |
| Last-mile Driver | Operator | Delivers to the destination warehouse when the modality is "by the operator". | Every package | Yes (destination) |

## Chain of custody (11 internal states; the last-mile step depends on the modality)
1. **creada** — Merchant.
2. **asignada_operador** — Coordinator picks the operator and the last-mile modality (`operador` | `retiro`).
3. **aceptada** — Dispatcher accepts (or rejects with a reason: the order returns to `creada`).
4. **recoleccion_asignada** — Dispatcher designates driver + vehicle.
5. **recolectada** — Pickup driver: count adjustment if needed, SCAN per package + SIGNATURE of an authorized person (RUT visually checked).
6. **en_bodega_operador** — Clerk: SCAN per package (origin hub).
7. **asignada_transporte** — Clerk assigns bus/service and departure. If the departure is more than 2 h after the assignment: SLA risk.
8. **cargada_bus** — Bus driver: SCAN per package. Loaded within 2 h of assignment? -> `ventana_ok`.
9. **en_bodega_destino** — Clerk: SCAN per package (destination hub).
10. **ultima_milla_asignada** (modality `operador`) or **lista_retiro** (modality `retiro`).
11. **entregada** — Last-mile driver (or clerk, in pickup) SCAN per package + SIGNATURE of an authorized person at destination.

Merchant-facing simplified status (5): Created → Assigned → Pickup → In transit → Delivered.

## Rules
- Every physical hand-over: scan of each package + timestamp + user. Only pickup and final delivery also need a signature.
- Identity verification is visual only: at least 2 authorized persons per point (name, RUT, phone).
- The pickup driver CAN change the box count, always with a reason; the difference is stored (`conteo`) and an open "count" incident is created. The signature stays mandatory.
- The bus assignment is manual, with a suggestion of the next service from the operator timetable.
