# Open Decisions and Risks

## On hold
- **Billing model**: monthly consolidated invoice; the basis of calculation (per package, per order, per weight, fixed contract rate) is unknown. Parked until the end of the project. Orders already store client reference and billing period so that no data is lost.

## To be decided (questions for the logistics consultant)
1. How is the package label / QR physically produced: portable thermal printer at the merchant warehouse vs. label printed in the office beforehand?
2. Offline / failed-scan exception flow: what happens when there is no signal or a label is damaged? Proposal: manual forced registration with a mandatory reason code, flagged for review.
3. Authorized persons: closed list per warehouse or free entry per order?
4. Does one Transport Operator serve several Merchants, or are operators dedicated per Merchant? Impacts the Coordinator portal and operator modeling.
5. Handling of partial deliveries (e.g. 24 of 25 packages scanned at destination): incident workflow, order closure rules and SLA impact.
6. Definition of SLA targets per route and service type (standard / express).
7. Handling of returns and damaged goods (photo evidence at each scan).

## Delivery roadmap
1. Merchant registration wizard + order list (static JSON).
2. Simplified tracking view + per-package status.
3. Logistics Coordinator portal: pending orders, assign to operator.
4. Operator scanning mobile app for the four operator roles, with signature at pickup and delivery.
5. Bulk CSV upload, incidents, returns.
6. Documents, reports / SLA, billing (once defined).
