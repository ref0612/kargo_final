# KARGO — System Overview

## Product
KARGO is a B2B warehouse-to-warehouse freight platform (Chile). A **Merchant** (the client, e.g. Falabella) moves goods between its own warehouses. Kargo coordinates the movement and a **Transport Operator** executes it, using intercity buses as the main line-haul.

## Business model
- B2B only. There is no per-shipment payment at order creation.
- Billing is consolidated monthly per client. **Billing design is ON HOLD** (no information yet on the calculation model). It must not block the rest of the build.

## Scope principles
1. The Merchant only **creates** orders. They do not assign carriers, scan, or manage operations.
2. Mobile-first: everything must be doable from a phone (375px).
3. Order registration is the highest-frequency task and must be minimal in taps.
4. Every physical hand-over of a package requires: a **scan of each package**, a **timestamp** (date + time) and the **responsible user**.
5. Only pickup (origin) and final delivery (destination) also require an **electronic signature** from an authorized person.
6. Identity verification is **visual only**: the Merchant registers at least 2 authorized persons (name, RUT, phone) per handover point; the operator compares the RUT with the physical ID.
7. Backend for the prototype phase = static JSON files (no server).

## Reference applications evaluated
- **kargo-flow-2** (Netlify): best visual quality and best mobile behavior; real order-creation modal but it captures no package data.
- **kargo 2.0** (Vercel): best process vision (multi-role simulation, package-level manifest, live events) but no real creation form and not mobile-responsive.
- Decision: rebuild from scratch, taking the creation UX and sidebar taxonomy from kargo-flow-2 and the lifecycle / package traceability / event feed from kargo 2.0.
