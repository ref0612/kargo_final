# Data Model (JSON files acting as backend)

Files live in `web/data/`. They simulate database tables and are the contract for the development team.

## merchants.json — entity Merchant
Fields: id, legal name, RUT, plan, billing mode (monthly consolidated), list of Warehouses. Each Warehouse has id, name, city (used by the origin dropdown filter), address, default authorized contacts (name, RUT, role, phone).

## orders.json — entity Order (OT)
An Order belongs to one Merchant and moves between an origin Warehouse and a destination Warehouse. It contains:
- personas_autorizadas (authorized persons) for origin and destination, min 2 each.
- referencia_cliente (client PO / reference) and periodo_facturacion (billing period, null until billing is defined).
- packages: list of Package ids; bultos_total.
- operacion (operation): coordinator id, operator id, pickup driver + vehicle plate, operator warehouse entry, bus plate + service + driver.
- handoff: entrega (signature at origin) and recepcion (signature at destination).
- timeline: ordered list of steps with timestamp and actor role. Order status is the last step, derived.

## packages.json — entity Package
An Order has 1..n Packages. Each has piece_code (label / QR), weight, description, declared value, status and scan_history. Every scan_history entry has: checkpoint, actor_id, actor_role, timestamp, signature url (only pickup and delivery).

## tracking_events.json — entity Tracking Event
Append-only log of the whole chain: order created, assigned to operator, pickup assigned, package scanned at pickup, at operator warehouse, on bus, at delivery, incident reported. The order timeline and package scan_history are derived views of this log. It is the audit trail for disputes and, later, billing.

## roles.json — entity Role
Roles with level (client, kargo, operator) and permission list. The Merchant is explicitly forbidden from assigning operators, scanning packages and editing operations.

## invoices.json — entity Invoice (ON HOLD)
Monthly consolidated invoice grouping the billable orders of a period. Calculation formula undefined: parked.

## Relations
Merchant 1—n Warehouse; Merchant 1—n Order; Order 1—n Package; Order 1—n Tracking Event; Package 1—n Scan; Order n—1 Invoice (period); User n—1 Role; Order n—1 Transport Operator.
