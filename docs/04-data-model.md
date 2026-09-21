# Data Model (JSON files acting as backend)

Files live in `web/data/`. They simulate database tables and are the contract for the development team. `npm run seed` regenerates them by running a scenario through the real rules (`web/store.js`).

| File | Entity | Notes |
|---|---|---|
| `merchants.json` | Merchant + Warehouses | Warehouses have `ciudad`, address with optional `codigo_postal`, and default authorized contacts (name, RUT, phone). Registered by the KAM. |
| `users.json` | Demo users | No passwords. Real auth belongs to the backend. |
| `operators.json` | Transport operator | Imported from Konnect. `vehiculos` (with `costo_dia`), `servicios` (timetable: origin, destination, `salidas` HH:MM), `puntos_retiro` per city. |
| `konnect.json` | Konnect catalog (mock) | Source for the operator import (prefetch): fleet, timetable, team. |
| `roles.json` | Roles and permissions | 9 roles; permissions are the strings checked by the store. |
| `orders.json` | Order (OT) | See below. |
| `packages.json` | Package | `piece_code`, `scan_history`, flags `agregado_en_recoleccion` / status `no_recolectado`. |
| `tracking_events.json` | Event log | Append-only audit trail; the order timeline and package scans are derived views. |
| `incidents.json` | Incident | Types: `conteo`, `dano`, `faltante`, `otro`. Open/resolved with note; optional photo. |
| `config.json` | Business rules | `sla_promesa_horas` (48), `ventana_bus_horas` (2). |
| `invoices.json` | Invoice | ON HOLD, empty on purpose. |

## Order (orders.json)
- `bultos_declarados` (immutable), `bultos_total` (current), `conteo` `{declarados, recolectados, diferencia, motivo, por, at}`.
- `mpo` (lot) and `referencia_cliente` (client PO), `personas_autorizadas` (origen/destino, min 2 each).
- `operacion.aceptacion` `{estado, at, rechazos[]}`; `operacion.transporte` `{servicio_id, bus_patente, salida, salida_at, asignado_at, cargado_at, riesgo_sla, ventana_ok}`.
- `operacion.ultima_milla` `{modalidad: 'operador'|'retiro', conductor_id, movil_patente, punto_retiro, lista_at}`.
- `operacion.bodega_operador` and `operacion.bodega_destino_operador` (`ingreso_at`).
- `handoff.entrega` / `handoff.recepcion`: signature, authorized person, scanning user, time.
- `timeline`: ordered steps with time and actor.

## Relations
Merchant 1—n Warehouse; Merchant 1—n Order; Order 1—n Package; Order 1—n Tracking Event; Order 1—n Incident; Operator 1—n Service (timetable); Package 1—n Scan; Role 1—n User.

## Computed (not stored)
KPIs (SSP, acceptance, PTAT, pickup adherence, successful inbound, service level, bus window, MPO compliance, cost per package), reconciliation per checkpoint, and the finance report by client/period are all derived from these files.
