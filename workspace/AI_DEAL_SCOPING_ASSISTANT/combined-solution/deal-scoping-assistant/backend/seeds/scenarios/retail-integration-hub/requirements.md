# Discovery Call Notes — Order and Inventory Integration Hub

**Customer:** Vellamo Retail Group
**Date:** 5 February 2026, 09:00–10:45 CET (video)
**Attendees (customer):** Petra Lindqvist (Head of Retail Technology), Marcus Oyelaran (SAP Integration Lead), Sandrine Bequet (Head of E-commerce Operations), Tomas Reinholt (Data & Analytics Manager)
**Attendees (us):** account lead, solution architect, integration architect
**Notes taken by:** solution architect. Unverified statements are marked "(to confirm)".

## 1. Company and current state

Vellamo runs 214 stores across Finland, Sweden and Poland plus a Shopify Plus storefront
that opened in 2023. Annual revenue about EUR 680 million. Roughly 9,000 SKUs, of which
about 1,400 are seasonal and change twice a year.

Core systems named on the call:

1. SAP S/4HANA (on-premises, release 2022) — master data, purchasing, finance, stock ledger.
2. Salesforce Service Cloud — customer service, order enquiries, returns authorisation.
3. Shopify Plus — the direct-to-consumer storefront.
4. A third-party logistics provider ("Nordkap Logistics") that operates two warehouses and
   exchanges files over SFTP only. No API. Files are CSV with a fixed-width variant for one feed.
5. Snowflake data warehouse — reporting, currently loaded by a mix of SAP extracts and
   hand-written Python scripts on a single VM.
6. An in-house POS system in stores, which writes sales to SAP every 15 minutes.

## 2. The problem in their words

"Every integration is point to point and someone's side project." Petra counted 31 interfaces,
of which 9 are scheduled shell scripts nobody owns. Two specific pain points:

- Inventory shown on Shopify is up to 6 hours stale. During the November peak they oversold
  about 2,300 orders and had to cancel them manually.
- Order status in Salesforce does not match the 3PL's dispatch files, so agents open SAP and
  the 3PL portal in separate tabs. Average handle time is 8 minutes; they want under 5.

## 3. Integration requirements discussed

1. **Order capture**: Shopify orders to SAP S/4HANA as sales orders. Target under 2 minutes end
   to end. Roughly 11,000 orders a day, peak 68,000 on Black Friday (to confirm — Sandrine quoted
   from memory).
2. **Order release to 3PL**: batched file to Nordkap over SFTP, currently four drops a day at
   06:00, 11:00, 15:00 and 19:00 CET. Nordkap will not change the schedule before 2027.
3. **Dispatch and tracking confirmations**: Nordkap returns a dispatch file and a tracking file.
   File names include a sequence number; gaps have gone unnoticed for days.
4. **Inventory position**: near-real-time availability from SAP and the 3PL to Shopify and to
   the POS. Target refresh under 5 minutes. Needs an available-to-promise calculation that
   subtracts reserved stock (to confirm which system owns the reservation).
5. **Returns**: Salesforce creates a return authorisation, 3PL receives the goods, SAP posts
   the credit. Three systems, currently entirely manual.
6. **Customer and order data to Snowflake**: nightly, plus an intraday order-events feed for the
   operations dashboard.
7. **Product master out of SAP** to Shopify and Salesforce, including price and tax class.
   Roughly 9,000 SKUs, full load nightly, deltas during the day.
8. **Finance postings**: daily settlement file from the payment provider reconciled against
   Shopify orders and posted to SAP.

## 4. Non-functional and operational points

- Every interface needs retry with backoff, a dead-letter destination and an operator view.
  Marcus was explicit: "we need to see what failed and replay it ourselves."
- Daily reconciliation between Shopify orders, SAP sales orders and 3PL dispatches, with a
  break report. This was the single most requested item on the call.
- File integrations need duplicate detection and sequence-gap detection.
- Peak sizing: Black Friday week is 6x normal order volume.
- Retention: message payloads 90 days, reconciliation results 7 years (Tomas, to confirm with finance).
- Personal data in orders is in scope of GDPR. No special-category data. PCI is out of scope
  because card data stays with the payment provider (to confirm with their security team).
- Monitoring must feed their existing Grafana instance if possible.

## 5. Technology direction

AWS is confirmed. They have an AWS Organization with three accounts today and a stated
preference for managed services over anything they have to patch. Petra said "no Kafka
cluster we have to run ourselves." Region: eu-north-1, with eu-west-1 mentioned for
services not available in Stockholm.

They are open to an iPaaS product but have not budgeted for licences, so a build on AWS
managed services is the working assumption.

## 6. Timeline and constraints

- Hard requirement: inventory accuracy fixed before the 2026 peak. Code freeze 1 November 2026.
- Nordkap contract renewal is in mid-2027; an API may become available then, so file
  integrations should not be built in a way that blocks a later switch.
- Their team can provide one SAP integration developer half time and one analyst full time.
- Contingency in their internal business case is 15%. Petra noted the steering group may
  push this up given the 3PL dependency.

## 7. Open questions raised on the call

- Who owns the stock reservation — SAP or the 3PL? Nobody on the call could answer.
- Is the Black Friday order peak 68,000 per day or per hour? Sandrine to check.
- Does Salesforce need write access to SAP, or is a read-only view of order status enough?
