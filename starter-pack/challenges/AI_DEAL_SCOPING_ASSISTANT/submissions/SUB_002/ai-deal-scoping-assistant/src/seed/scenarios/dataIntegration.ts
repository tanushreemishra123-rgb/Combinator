/**
 * Seed scenario 2 of 4: data and integration heavy.
 * A logistics/retail distribution group consolidating order, inventory and shipment data from
 * several named systems into a governed analytics platform, with an explicit BigQuery/Looker
 * (GCP) leaning so the platform recommender has a stated preference to honour.
 */
import type { SeedScenario } from '..';

const REQUIREMENTS_TEXT = `# Unified Supply Chain Analytics - RFP Extract and Discovery Notes

## 1. Background

Harrow and Vale Distribution Group is a wholesale and retail distribution business operating 46 regional depots across the United Kingdom and Ireland.
We move approximately 9.4 million order lines per year across our wholesale and direct-to-consumer channels.
Today, order, inventory and shipment data lives in four disconnected systems and nobody in the business can answer "what is our true available-to-promise stock right now" without a manual reconciliation that takes two full days.
We want a partner to design and build a governed analytics platform that consolidates this data and gives merchandising, supply chain and finance a single, trustworthy view.

## 2. Current Systems Landscape

SAP ECC is our order-management and finance system of record, running on-premises, and generates roughly 40,000 sales order changes per day.
Salesforce Sales Cloud holds our wholesale account and opportunity data for the 1,200 trade accounts our field sales team manages.
Our warehouse management system is Manhattan Associates WMS, deployed across all 46 depots, and is the source of truth for pick, pack and stock-on-hand events.
Carrier shipment tracking arrives as EDI 214 and EDI 856 messages over SFTP from our three main carriers: DHL, UPS and a regional Irish carrier called Fastway.
A legacy Access-based spreadsheet process is currently used to reconcile SAP ECC and Manhattan WMS stock counts weekly, which the COO wants eliminated entirely.
We currently have no single inventory ledger; each depot manager keeps a local spreadsheet of "known good" stock adjustments.

## 3. Business Requirements

BR1. The platform must give merchandising a single, trusted view of available-to-promise inventory across all 46 depots, refreshed at least hourly.
BR2. The platform must eliminate the current weekly manual reconciliation between SAP ECC and Manhattan WMS.
BR3. The platform should let supply chain planners forecast depot-level stockouts at least two weeks in advance.
BR4. The platform must give finance a consolidated view of order value, margin and carrier cost by depot and by trade account.
BR5. The platform could support a future customer-facing order-tracking experience, though that is not in scope for this phase.

## 4. Functional Requirements

FR1. The platform must ingest sales order and order-line data from SAP ECC, including order status changes, at least every 15 minutes.
FR2. The platform must ingest wholesale account and opportunity data from Salesforce Sales Cloud daily.
FR3. The platform must ingest pick, pack and stock-on-hand events from Manhattan WMS in near real time across all 46 depots.
FR4. The platform must parse and load EDI 214 and EDI 856 carrier messages delivered over SFTP from DHL, UPS and Fastway.
FR5. The platform must reconcile inventory positions between SAP ECC and Manhattan WMS automatically and surface variances above a configurable threshold.
FR6. Supply chain planners must be able to build a depot-level stockout forecast using at least twelve months of trailing order history.
FR7. Finance analysts must be able to build margin and carrier-cost reports blended from SAP ECC order data and carrier EDI cost fields.
FR8. The platform should let merchandising build ad hoc dashboards in Looker without needing data-engineering support for every new question.
FR9. Data stewards must be able to see and correct records that fail data-quality validation before they reach reporting layers.
FR10. The platform must maintain a full lineage trail showing which source system and load run produced every reported metric.

## 5. Non-Functional Requirements

NFR1. The platform must support 40,000 SAP ECC order-line changes per day at peak, including the pre-Christmas trading period, without backlog.
NFR2. Depot-level inventory dashboards must refresh within 60 minutes of a source-system change during business hours.
NFR3. The platform must support approximately 350 named users across merchandising, supply chain and finance.
NFR4. Data-quality checks must flag any depot with more than a 2% variance between SAP ECC and Manhattan WMS stock counts within the same reporting cycle.
NFR5. The platform must retain transaction-level order and shipment data for at least six years to satisfy UK tax and audit requirements.
NFR6. EDI file processing must be idempotent so a resent or duplicate carrier file never double-counts a shipment.

## 6. Integration Requirements

INT1. Batch integration with SAP ECC for order, order-line and finance postings, using SAP-provided extract tables or IDocs.
INT2. Event-driven integration with Manhattan WMS for pick, pack and stock-on-hand events, ideally via the WMS's published event stream.
INT3. Daily batch integration with Salesforce Sales Cloud for wholesale account and opportunity data.
INT4. File-based SFTP integration to receive EDI 214 and EDI 856 messages from DHL, UPS and Fastway on a schedule agreed with each carrier.
INT5. The platform should expose a secure API so a future customer-tracking experience can query shipment status, though that build is out of scope now.
INT6. The platform must integrate with our existing Okta tenant for staff authentication into Looker and any data-steward tooling.

## 7. Data Requirements

DATA1. Order, inventory and shipment data must be modelled into a governed set of conformed dimensions (depot, product, carrier, trade account) usable across all reports.
DATA2. Data ownership must be assigned per domain: supply chain owns inventory and shipment data, finance owns order and margin data.
DATA3. Data quality rules must check for missing SKU mappings, negative stock quantities and orphaned shipment records on every load.
DATA4. Master product and depot reference data must be reconciled between SAP ECC and Manhattan WMS, since SKU codes differ slightly between the two systems today.
DATA5. Transaction-level detail must be retained for six years; aggregated reporting marts may be retained indefinitely.
DATA6. Trade-account data from Salesforce contains personal contact details for account owners and must be handled as confidential business data.

## 8. Security and Compliance

SEC1. All data in transit between depots, carriers and the analytics platform must be encrypted using current TLS standards.
SEC2. Role-based access control must restrict depot-level margin data to finance and senior supply chain roles only.
SEC3. SFTP credentials for each carrier must be stored in a managed secrets service and rotated at least every 90 days.
SEC4. An audit trail must record every manual data-quality correction, including who made it and when.
SEC5. The platform must support UK GDPR requirements for the personal contact data held in the Salesforce trade-account extracts.

## 9. Technology Preferences

TECH1. Our BI team has standardised on Looker for dashboards and would like the underlying warehouse to be BigQuery so Looker's native modelling layer can be used directly.
TECH2. We currently have no cloud footprint for analytics, so the delivery partner should recommend the supporting data-pipeline and orchestration services rather than assume Google Cloud is a given beyond the warehouse and BI layer.
TECH3. Our two in-house data analysts know SQL and Python; a platform that keeps transformation logic in SQL where practical is preferred.

## 10. Delivery Constraints and Timeline

CON1. The platform must be live and reconciling SAP ECC against Manhattan WMS before our pre-Christmas peak trading period begins, which the program sponsor has set at 30 weeks from contract signature.
CON2. Depot rollout should be phased, starting with our five largest depots by order volume before extending to the remaining 41.
CON3. Our data team can allocate one data analyst half-time to this program; the delivery partner is expected to own data engineering and pipeline build.
CON4. The legacy Access-based reconciliation spreadsheet must be formally retired within 90 days of the new platform going live.

## 11. Discovery Call Notes - 2026-08-27

Attendees: COO, Head of Supply Chain, BI Manager (Harrow and Vale); Engagement Manager, Data Architect (delivery partner).
The COO restated that eliminating the manual weekly reconciliation is the single most visible win the board is expecting from this program.
The BI Manager confirmed Looker is already licensed for 60 seats and the team does not want to evaluate an alternative BI tool.
The Head of Supply Chain flagged that Fastway's EDI feed has historically been the least reliable of the three carriers and asked for extra validation on that feed specifically.
It is still unconfirmed whether Manhattan WMS can publish real-time stock events at all 46 depots or only at the 12 depots on the newer WMS version; the BI Manager will confirm with the WMS vendor.
No decision has been made on whether historical data migration should go back three years or the full six-year retention window at initial load.
`;

/** Harrow and Vale Distribution Group - multi-source supply-chain analytics with a BigQuery/Looker (GCP) leaning. */
export const dataIntegrationScenario: SeedScenario = {
  id: 'data-integration-supply-chain-analytics',
  name: 'Unified Supply Chain Analytics',
  category: 'data-integration',
  tagline: 'Logistics and retail distribution group consolidating SAP, Salesforce, WMS and carrier EDI data onto BigQuery and Looker.',
  customer: {
    customerName: 'Harrow and Vale Distribution Group',
    industry: 'Wholesale Distribution and Retail',
    opportunityName: 'Unified Supply Chain Analytics Program',
    region: 'United Kingdom and Ireland',
    engagementType: 'Fixed-scope data platform program',
    notes:
      'Requirements gathered from an RFP issued 2026-08-11 and a follow-up discovery call on 2026-08-27 with the COO, the Head of Supply Chain and the BI Manager.',
  },
  requirementsText: REQUIREMENTS_TEXT,
  config: {
    cloudPlatform: 'gcp',
    cloudSelectionMode: 'user-selected',
    expectedUsers: 350,
    targetRegions: ['United Kingdom', 'Ireland'],
    deliveryDeadlineWeeks: 30,
    environments: 3,
    aiProviderPreference: 'no-preference',
  },
};
