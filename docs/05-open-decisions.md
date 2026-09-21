# Open Decisions and Risks

## Decided after the consultant review
- **Last mile:** two modalities per order, chosen by the coordinator: by the operator (default) or recipient pickup at a point given by the operator. Third-party last mile is out for now.
- **Pickup count:** the pickup driver can change the number of packages and print new labels; every change needs a reason and is stored as a variance. The signature of the merchant / handing-over person is mandatory.
- **Bus:** manual assignment by the clerk with a suggestion from the operator timetable; a departure more than 2 h after the assignment is flagged as SLA risk.
- **Control Tower + network admin** live inside the Coordinator role. Audit and Finance are new read-only roles.
- **Onboarding:** operators are imported from Konnect (prefetch); merchants are registered by the KAM from the coordinator view.

## Still on hold
- **Billing model** (monthly consolidated invoice; basis of calculation unknown). Finance is read-only and shows no prices.
- **Third-party last mile** and who pays for it.

## To define (consultant / business)
1. Scan nomenclature table (consultant left it empty): proposed list in the mockup guide.
2. Real GPS integration with dispatcher vehicles (pending on the business side); the mockup only draws a schematic map.
3. Definition of "MPO" (assumed: master purchase order grouping several orders/lots) and the lot reconciliation rules.
4. Promised delivery time per route/service (mockup uses a single 48 h value) and the exact Service Level formula (the document mixes R<1 and R<=1).
5. Cost per shipment formula (the document has it inverted: shipments ÷ cost) and where vehicle/manpower costs come from.
6. Unloading at the destination is not scanned; confirm whether it stays that way once volumes grow (staging and outbound scans are excluded for now).
7. Failed or rescheduled delivery flow (the business expects it to be rare).
8. Label format: the mockup prints Code 39; the consultant shows QR/DataMatrix with "1/x". Portable printer integration.

## Delivery roadmap
1. Merchant wizard + tracking. 2. Coordinator: assignment, KPIs, onboarding. 3. Operator mobile app (accept, scan, sign, count adjustment). 4. Bus timetable suggestion + destination hub + last-mile modalities. 5. Audit and Finance dashboards. 6. GPS, printer, bulk CSV, billing.
