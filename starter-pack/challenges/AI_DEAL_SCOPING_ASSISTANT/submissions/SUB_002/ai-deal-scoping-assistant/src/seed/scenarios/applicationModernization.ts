/**
 * Seed scenario 1 of 4: application modernization.
 * A regional P&C insurer replacing a legacy .NET/Oracle claims portal, written as an RFP extract
 * plus discovery-call notes so the requirements analyzer has real must/should language, named
 * systems, an explicit NFR set and a stated cloud preference to ground against.
 */
import type { SeedScenario } from '..';

const REQUIREMENTS_TEXT = `# ClaimsDesk Modernization - RFP Extract and Discovery Notes

## 1. Background

Meridian Assurance Group is a regional property and casualty insurer operating in Washington, Oregon and Idaho.
We write personal auto, homeowners and small commercial policies through a network of 340 independent agents.
Our claims organisation processes approximately 58,000 first-notice-of-loss events per year.
The current claims intake and adjudication system, internally called ClaimsDesk, was built in 2011 on .NET Framework 4.8 with an Oracle 19c database.
ClaimsDesk is reaching end of vendor support and cannot be hosted on any current-generation Windows Server release.
We issued this RFP to select a partner to design and deliver a modernised claims portal on a supported, cloud-native stack.

## 2. Current Systems Landscape

Guidewire ClaimCenter is used by our claims examiners for reserve setting and payment authorisation; ClaimsDesk must continue to exchange claim status and payment data with it.
SAP S/4HANA is our finance and general-ledger system of record; every approved claim payment must post to SAP as a journal entry.
Okta is our corporate identity provider and already issues SSO for 1,850 internal staff across claims, underwriting and finance.
Adjusters currently rediscover claim details by re-keying data between ClaimsDesk and Guidewire ClaimCenter, which our claims VP flagged as the single biggest source of processing delay.
The existing ClaimsDesk database holds nineteen years of claim history, roughly 4.2 TB of structured data plus 1.1 TB of scanned PDF and image attachments.
A separate legacy mainframe, referred to internally as the Policy Admin System, is being retired by a different program and is out of scope for this engagement.

## 3. Business Requirements

BR1. The solution must reduce average claim-intake processing time from 45 minutes to under 15 minutes per first-notice-of-loss.
BR2. The solution must give claims examiners a single screen that shows policy, claim and payment status without switching between ClaimsDesk and Guidewire ClaimCenter.
BR3. The solution should improve first-contact resolution for straightforward auto glass and windshield claims to reduce reliance on phone-based adjusters.
BR4. The solution must support our 340 independent agents submitting new claims directly rather than calling our call centre.
BR5. The solution could introduce a policyholder-facing status tracker so claimants can check progress without calling an examiner.

## 4. Functional Requirements

FR1. Claims examiners must be able to create, update and close a claim record, including reserve amounts synchronised from Guidewire ClaimCenter.
FR2. The portal must let agents upload first-notice-of-loss documents, including photos, estimates and police reports, directly against a claim.
FR3. The portal must display a consolidated claim timeline combining ClaimsDesk activity, Guidewire ClaimCenter reserve changes and SAP S/4HANA payment postings.
FR4. Claims examiners must be able to approve a payment that then posts automatically to SAP S/4HANA as a journal entry without manual re-entry.
FR5. The portal should let policyholders view claim status, upload additional documents and message their assigned adjuster.
FR6. Supervisors must be able to reassign claims between examiners and view team workload dashboards.
FR7. The portal must retain full claim history for at least seven years to satisfy state insurance record-keeping rules.
FR8. The portal should allow examiners to flag a claim for special-investigation-unit review, notifying the SIU team automatically.
FR9. Independent agents must be able to see the status of claims they submitted but must not see claims submitted by other agencies.
FR10. The portal could offer examiners a suggested reserve range based on similar historical claims, clearly marked as advisory only.

## 5. Non-Functional Requirements

NFR1. The portal must be available 99.9% of the time during business hours, 7am to 9pm Pacific, Monday through Saturday.
NFR2. Claim search results must return within 2 seconds for 95% of queries under normal load.
NFR3. The system must support 1,850 internal staff and approximately 240,000 active policyholders as registered users.
NFR4. The portal must support at least 900 concurrent internal sessions during a regional catastrophe event without degradation.
NFR5. Recovery point objective for claim data must be under 15 minutes and recovery time objective must be under 4 hours.
NFR6. The portal must be accessible to WCAG 2.1 AA standards because several of our agent partners have accessibility requirements on staff.
NFR7. All claim and payment activity must be captured in an immutable audit log retained for a minimum of seven years.

## 6. Integration Requirements

INT1. The portal must integrate with Guidewire ClaimCenter for reserve and payment-authorisation data, in near real time.
INT2. The portal must integrate with SAP S/4HANA to post approved claim payments as finance journal entries.
INT3. The portal must federate authentication through Okta using SAML or OIDC for all internal staff.
INT4. The portal should integrate with our document-imaging vendor, currently Hyland OnBase, to retrieve scanned historical claim files.
INT5. The portal must expose a secure API for the 340 independent agents' agency-management systems to submit first-notice-of-loss data.
INT6. The portal should send SMS and email notifications through our existing Twilio account when a claim status changes.

## 7. Data Requirements

DATA1. Claim, policy and payment data must be migrated from the legacy ClaimsDesk Oracle 19c database with full referential integrity.
DATA2. The 1.1 TB of scanned attachments must be migrated or linked without loss of the original document metadata.
DATA3. Claim and policyholder data is personally identifiable information and must be classified and handled accordingly.
DATA4. Historical claim data older than seven years may be archived to cold storage rather than kept in the primary database.
DATA5. Data quality checks must confirm that migrated claim totals reconcile exactly against the legacy ClaimsDesk reporting extracts before cutover.

## 8. Security and Compliance

SEC1. The solution must comply with the EU General Data Protection Regulation for the subset of policyholders who are EU residents on international travel riders.
SEC2. All personal data must be encrypted at rest and in transit using current industry-standard algorithms.
SEC3. Role-based access control must ensure examiners only see claims assigned to their team, with supervisor override logged.
SEC4. Multi-factor authentication must be enforced for all internal staff accessing claim payment approval functions.
SEC5. The solution must undergo a third-party penetration test before go-live and annually thereafter.
SEC6. Independent agents accessing the agent API must be issued scoped API credentials that can be revoked individually.

## 9. Technology Preferences

TECH1. Our infrastructure team standardised on Microsoft Azure two years ago and we would prefer the new claims portal to run on Azure.
TECH2. We are open to a managed PostgreSQL or Azure SQL database as the system of record, replacing the Oracle 19c instance.
TECH3. Our internal engineering team has React and .NET experience, so a stack that our staff can support after handover is preferred.

## 10. Delivery Constraints and Timeline

CON1. The new portal must go live before our June 2027 policy renewal season begins, which the program office has translated into a target of 46 weeks from contract signature.
CON2. Legacy ClaimsDesk must keep running in parallel with the new portal for a 60-day stabilisation period after cutover.
CON3. Our claims operations team can dedicate at most two business analysts and one QA lead to this program part-time; the delivery partner is expected to staff the rest.
CON4. A pilot rollout to the Idaho claims team is required before statewide rollout to Washington and Oregon.

## 11. Discovery Call Notes - 2026-08-21

Attendees: VP Claims Operations, IT Director, Enterprise Architect (Meridian); Engagement Manager, Solution Architect (delivery partner).
The VP Claims Operations reiterated that re-keying data between ClaimsDesk and Guidewire ClaimCenter is the top complaint from examiners in engagement surveys.
The IT Director confirmed Okta is the corporate standard and no other identity provider will be considered.
The Enterprise Architect flagged that the Hyland OnBase contract renews in November 2026 and asked whether the new portal could eventually replace it, but this is explicitly out of scope for this phase.
The IT Director could not yet confirm whether SAP S/4HANA exposes a REST API or only IDoc/BAPI interfaces for journal posting and will follow up after checking with the SAP basis team.
No decision has been made yet on whether the policyholder-facing status tracker (FR5) ships in the initial release or a fast-follow phase.
`;

/** Meridian Assurance Group - .NET/Oracle claims-portal modernisation with a stated Azure preference. */
export const applicationModernizationScenario: SeedScenario = {
  id: 'app-modernization-claims-portal',
  name: 'ClaimsDesk Modernization',
  category: 'application-modernization',
  tagline: 'Regional insurer replacing a legacy .NET/Oracle claims portal with a cloud-native platform on Azure.',
  customer: {
    customerName: 'Meridian Assurance Group',
    industry: 'Property and Casualty Insurance',
    opportunityName: 'ClaimsDesk Modernization Program',
    region: 'Pacific Northwest, USA (Washington, Oregon, Idaho)',
    engagementType: 'Fixed-scope modernization program',
    notes:
      'Requirements gathered from an RFP issued 2026-08-14 and a follow-up discovery call on 2026-08-21 with the VP of Claims Operations, the IT Director and the Enterprise Architect.',
  },
  requirementsText: REQUIREMENTS_TEXT,
  config: {
    cloudPlatform: 'azure',
    cloudSelectionMode: 'user-selected',
    expectedUsers: 241_850,
    targetRegions: ['Washington, USA', 'Oregon, USA', 'Idaho, USA'],
    deliveryDeadlineWeeks: 46,
    environments: 4,
    aiProviderPreference: 'no-preference',
  },
};
