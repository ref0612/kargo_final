# Graph Report - kargo_final  (2026-09-21)

## Corpus Check
- Corpus is ~2,452 words - fits in a single context window. You may not need a graph.

## Summary
- 61 nodes · 102 edges · 8 communities (7 shown, 1 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Scan and Signature Custody Rules
- Coordination and Operator Roles
- Product Scope and Principles
- Merchant Order Wizard
- Order and Role Data
- Package and Audit Trail Data
- Merchant and Warehouse Data
- Authorized Persons Verification

## God Nodes (most connected - your core abstractions)
1. `Chain of custody (8 steps)` - 11 edges
2. `Merchant order registration wizard` - 9 edges
3. `Entity: Order (OT)` - 9 edges
4. `KARGO Platform` - 8 edges
5. `Transport Operator` - 8 edges
6. `Rule: scan + timestamp + user at every hand-over` - 8 edges
7. `4. Picked up at origin (scan + signature)` - 8 edges
8. `8. Delivered at destination (scan + signature)` - 7 edges
9. `5. Received at operator warehouse WH1 (scan)` - 5 edges
10. `7. Loaded onto bus (scan)` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Reference app: kargo-flow-2 (best UX)` --inspired--> `Merchant order registration wizard`  [INFERRED]
  docs/01-system-overview.md → docs/03-merchant-order-flow.md
- `Reference app: kargo 2.0 (best process vision)` --inspired--> `Chain of custody (8 steps)`  [INFERRED]
  docs/01-system-overview.md → docs/02-roles-and-chain-of-custody.md
- `Piece code / QR per package` --scanned_at--> `4. Picked up at origin (scan + signature)`  [INFERRED]
  docs/03-merchant-order-flow.md → docs/02-roles-and-chain-of-custody.md
- `Entity: Order (OT)` --timeline_follows--> `Chain of custody (8 steps)`  [INFERRED]
  docs/04-data-model.md → docs/02-roles-and-chain-of-custody.md
- `Entity: Scan record` --records--> `Rule: scan + timestamp + user at every hand-over`  [INFERRED]
  docs/04-data-model.md → docs/01-system-overview.md

## Hyperedges (group relationships)
- **Transport Operator internal roles** — dispatcher, pickup_driver, warehouse_clerk, bus_driver, delivery_driver [EXTRACTED 1.00]
- **Hand-over steps requiring package scan** — step4_picked_up, step5_wh1, step7_loaded_bus, step8_delivered [EXTRACTED 1.00]
- **Steps requiring signature + visual ID check** — step4_picked_up, step8_delivered, visual_id_check, authorized_persons [EXTRACTED 1.00]

## Communities (8 total, 1 thin omitted)

### Community 0 - "Scan and Signature Custody Rules"
Cohesion: 0.31
Nodes (13): Chain of custody (8 steps), Open: failed / offline scan exception flow, Open: partial delivery handling, Merchant simplified 5-state status, Rule: scan + timestamp + user at every hand-over, Rule: e-signature only at pickup and delivery, 4. Picked up at origin (scan + signature), 5. Received at operator warehouse WH1 (scan) (+5 more)

### Community 1 - "Coordination and Operator Roles"
Cohesion: 0.22
Nodes (11): Bus Driver / Assistant, Open: one operator serves many merchants?, Delivery Driver / Assistant, Dispatcher (operator), Logistics Coordinator, Pickup Driver / Assistant, Delivery roadmap (6 phases), 1. Created (+3 more)

### Community 2 - "Product Scope and Principles"
Cohesion: 0.22
Nodes (10): Entity: Invoice (ON HOLD), JSON files as backend (prototype), KARGO Platform, Merchant (client), Monthly Consolidated Billing (ON HOLD), Principle: Merchant only creates orders, Principle: Mobile-first, Decision: rebuild from scratch, best of both (+2 more)

### Community 3 - "Merchant Order Wizard"
Cohesion: 0.27
Nodes (10): Bulk CSV upload, Open: how are QR labels printed?, Open: returns and damaged goods, Merchant portal sections, Piece code / QR per package, Merchant order registration wizard, Confirmation: OT + package codes, Wizard 1: origin & destination (+2 more)

### Community 4 - "Order and Role Data"
Cohesion: 0.40
Nodes (3): Open: SLA targets per route / service, Entity: Order (OT), Entity: Role

### Community 5 - "Package and Audit Trail Data"
Cohesion: 0.50
Nodes (3): Entity: Tracking Event (audit log), Entity: Package, Entity: Scan record

### Community 6 - "Merchant and Warehouse Data"
Cohesion: 0.67
Nodes (3): Entity: Merchant, Entity: Warehouse, Origin warehouse dropdown filtered by city

## Knowledge Gaps
- **9 isolated node(s):** `Merchant simplified 5-state status`, `Bulk CSV upload`, `Open: how are QR labels printed?`, `Open: failed / offline scan exception flow`, `Open: authorized persons closed list vs free entry` (+4 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 15 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Confirmation: OT + package codes` connect `Merchant Order Wizard` to `Coordination and Operator Roles`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `Merchant order registration wizard` connect `Merchant Order Wizard` to `Product Scope and Principles`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `4. Picked up at origin (scan + signature)` connect `Scan and Signature Custody Rules` to `Coordination and Operator Roles`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **What connects `Merchant simplified 5-state status`, `Bulk CSV upload`, `Open: how are QR labels printed?` to the rest of the system?**
  _9 weakly-connected nodes found - possible documentation gaps or missing edges._