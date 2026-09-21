# Roles and Chain of Custody

## Organizational levels
1. **Merchant** (client level)
2. **Logistics Coordinator** (Kargo level)
3. **Transport Operator** (carrier level) with several internal roles

## Roles
| Role | Level | Responsibility |
|---|---|---|
| Merchant | Client | Creates the order (warehouses, authorized persons, packages). Read-only tracking afterwards. |
| Logistics Coordinator | Kargo | Receives the created order and assigns it to a Transport Operator. |
| Dispatcher | Operator | Receives the assignment; designates the driver and the vehicle for pickup. |
| Pickup Driver / Assistant | Operator | Goes to the origin warehouse, scans every package, captures the electronic signature of the person handing over. |
| Operator Warehouse Clerk (WH1) | Operator | Scans every package on entry to the operator warehouse; assigns the load to a bus / service. |
| Bus Driver / Assistant | Operator | Confirms loading of every package onto the bus by scanning. |
| Delivery Driver / Assistant | Operator | At destination scans every package and captures the digital signature of the person receiving. |

## Chain of custody (8 steps)
1. **Created** — Merchant. Registers origin/destination warehouses, authorized persons, packages.
2. **Assigned to operator** — Logistics Coordinator. Timestamp + user.
3. **Pickup assigned** — Dispatcher. Designates driver + vehicle. Timestamp + user.
4. **Picked up at origin** — Pickup Driver. SCAN per package + ELECTRONIC SIGNATURE of authorized person (RUT visually validated).
5. **Received at operator warehouse (WH1)** — Warehouse Clerk. SCAN per package.
6. **Assigned to transport** — Warehouse Clerk. Assigns the load to a bus/service. Timestamp + user.
7. **Loaded onto bus** — Bus Driver. SCAN per package.
8. **Delivered at destination** — Delivery Driver. SCAN per package + DIGITAL SIGNATURE of authorized person (RUT visually validated). Closes the order at the destination warehouse.

## Merchant-facing simplified status
Created -> Assigned -> Pickup in progress -> In transit -> Delivered. The eight internal steps are hidden from the Merchant.

## Rule
Steps 4, 5, 7 and 8 are physical hand-overs: scan of each package + timestamp + user are mandatory with no exceptions. Steps 4 and 8 additionally require a signature.
