# RFP Extract — Policy Administration Platform Modernization

**Issuer:** Halvard Mutual Insurance Group
**Reference:** HMG-RFP-2026-014, Section 3 "Scope and Requirements" (extract)
**Issued:** 12 March 2026
**Responses due:** 24 April 2026

## 3.1 Background

Halvard Mutual writes motor, home and small-commercial property policies in Norway,
Sweden and Denmark. We hold approximately 1.2 million in-force policies and process
roughly 210,000 claims a year.

Our policy administration system ("Vekter") was built in 2011 on an internal Java
monolith. It runs on twelve application servers in our own data centre in Oslo, with a
warm standby in Gothenburg. The database is Oracle 12c (about 4.2 TB), and roughly 340
PL/SQL packages contain business logic that is not represented anywhere in the Java
codebase. Overnight processing consists of 47 batch jobs scheduled in Control-M; the
longest (premium accrual and renewal generation) runs 4 hours 40 minutes and must finish
before 06:00 CET. Integration with brokers and the reinsurance platform is via 23 SOAP
web services, several of which still use WS-Security with X.509 tokens.

Two facts drive this procurement. First, our data centre lease ends in Q3 2028 and will
not be renewed. Second, Vekter cannot support the self-service capabilities our
distribution strategy now requires.

## 3.2 Objectives

1. Exit the Oslo data centre before the lease expiry, with no loss of policy or claims history.
2. Reduce the overnight batch window from 4 hours 40 minutes to under 90 minutes.
3. Enable a policyholder self-service portal (quote, view documents, change address, add a vehicle, start a claim).
4. Reduce the time to launch a new product variant from the current 9–14 months to under 3 months.
5. Keep the total cost of ownership flat or lower from year 3 onward.

## 3.3 Functional requirements

1. Policy lifecycle: new business, mid-term adjustment, renewal, cancellation, reinstatement.
2. Product configuration for motor, home and small-commercial property, maintained by business users rather than developers.
3. Premium calculation, including the existing rating tables and the no-claims-bonus ladder.
4. Document generation (policy schedule, certificate, renewal notice) in Norwegian, Swedish, Danish and English.
5. Customer self-service portal covering the journeys in 3.2 item 3. First release targets our
   existing online customers, about 5,000 active users per month.
6. Broker portal, retaining the current SOAP contracts for at least 24 months after go-live.
7. Claims intake only. Claims adjudication stays in our existing Guidewire ClaimCenter instance.

## 3.4 Non-functional requirements

1. Policy enquiry response under 400 ms at the 95th percentile.
2. 99.9% availability during 06:00–22:00 CET, planned maintenance excluded.
3. RPO 15 minutes, RTO 4 hours for policy data.
4. All personal data of EU/EEA data subjects must remain within the EU/EEA. We are subject to GDPR
   and to the Norwegian Financial Supervisory Authority's ICT regulations, and DORA applies to us
   from a contractual-oversight perspective.
5. Audit trail of every policy state change, retained for 10 years.
6. The platform must support a blue/green or equivalent release approach; we currently take
   a 6-hour outage per release and this is no longer acceptable.

## 3.5 Technology direction

Our group IT standard is Microsoft Azure. We have an existing Enterprise Agreement, two
landing zones (non-production and production) in Norway East and West Europe, and Microsoft
Entra ID is our corporate identity provider. We would consider PostgreSQL as the target
database, but the decision has not been made and the DBA team has raised concerns about the
PL/SQL estate. Please state clearly what you assume.

We will not accept a full rewrite delivered as a single cutover. Describe a phased approach.

## 3.6 Existing systems in scope of integration

- Guidewire ClaimCenter (on-premises, REST and JMS)
- SAP S/4HANA finance (premium postings, currently a nightly flat file)
- Experian-style credit and sanctions screening via a third-party gateway (SOAP)
- Bisnode-equivalent vehicle registry lookup (REST, rate limited to 5 requests/second)
- Corporate data warehouse on SQL Server 2019, fed by nightly extracts
- Document archive (OpenText), WebDAV interface

## 3.7 Delivery constraints

- Our change freeze runs from 1 December to 15 January each year.
- The Vekter team is 14 people; at most 4 can be released to the programme at any time.
- We expect a first production release of the self-service portal within 9 months of contract signature.
- Budget is not disclosed at this stage. We expect a ROM range with the assumptions stated.

## 3.8 Open points

We have not yet agreed internally whether the customer portal will be opened to all
policyholders at first release or only to those who already use online servicing. Please
size for the stated 5,000 monthly active users, and describe how your proposal would change
if the scope moved to the full policyholder base.

Two further points are undecided: whether the PL/SQL logic is re-platformed as-is or
re-expressed in the new application tier, and whether the broker SOAP services are fronted
by a gateway or reimplemented. We would like your view on both.
