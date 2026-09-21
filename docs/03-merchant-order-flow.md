# Merchant Order Registration Flow (mobile-first)

The Merchant's job ends when the order is confirmed. Everything after is operational.

## Step 1 — Origin and destination
- Origin warehouse: auto-selected when the Merchant has a single warehouse. With several warehouses: select a city, then choose from a dropdown filtered by that city.
- Destination: search among registered warehouses or create a new one.
- The Merchant can register and maintain its own list of warehouses (scalability requirement).

## Step 2 — Authorized persons
- At least 2 authorized persons at origin and at least 2 at destination.
- Fields: full name, RUT, phone.
- Pre-filled from the warehouse defaults, editable per order.
- Purpose: the operator visually validates the RUT against the physical ID at scan/signature time. This is the only identity verification.

## Step 3 — Packages
- Add package (repeatable): approximate weight, content description, optional declared value.
- Duplicate previous package with one tap. At least one package is required.
- Package weight is approximate; the operator may capture actual weight later.

## Confirmation
- The system generates the Order (OT) and one printable code/QR per package (piece code, e.g. KARGO-00123-001).
- The order status is "Created", waiting for the Logistics Coordinator.
- No photo or scan is required from the Merchant here: photo/scan is mandatory later and is performed by the operator at every hand-over.

## Fast path for volume
Create -> Bulk Upload (CSV template, origin warehouse fixed per account, row-by-row error preview before confirmation).

## Merchant portal sections
Home, Orders, Tracking, Incidents, Returns, Documents, Billing (ON HOLD), Account (warehouses, default authorized persons). Mobile uses a bottom navigation bar and a persistent "Register shipment" action.

## Update (v2)
- Optional **MPO / lot** field next to the client reference (used by the MPO compliance KPI).
- The **merchant prints and sticks the labels** (one per package, showing i/n). At pickup the driver may adjust the count and print new labels if it differs; the merchant sees the variance and any incident.
- New warehouses can also be registered by the KAM (coordinator view), with an optional 7-digit postal code.
