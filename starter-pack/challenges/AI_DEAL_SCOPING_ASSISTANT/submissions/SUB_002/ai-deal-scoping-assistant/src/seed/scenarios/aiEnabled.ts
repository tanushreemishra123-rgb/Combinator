/**
 * Seed scenario 3 of 4: AI-enabled solution.
 * A healthcare provider network wanting clinical-document intake and a patient-support assistant,
 * with explicit RAG, extraction, human-review, HIPAA and Epic/FHIR requirements and a stated AWS
 * preference so the AI-strategy and architecture planners have real signal to work from.
 */
import type { SeedScenario } from '..';

const REQUIREMENTS_TEXT = `# Clinical Intake and Patient Support Assistant - RFP Extract and Discovery Notes

## 1. Background

Harborview Health Network is a non-profit provider network of six outpatient clinics and one referral centre serving the greater Portland metro area.
Our clinics see approximately 85,000 patient encounters per month across primary care, behavioural health and physical therapy.
Referral letters, prior-authorisation forms and outside lab results arrive by fax, secure email and patient portal upload, and today a team of eleven medical records clerks manually reads and keys each document into our EHR.
Patients also call our front-desk line roughly 12,000 times per month with routine questions about appointment prep, billing and insurance coverage, most of which do not require clinical judgement.
We want a partner to build a clinical-document intake system and a patient-support assistant that reduce this manual burden while keeping every clinical decision in the hands of our staff.

## 2. Current Systems Landscape

Epic is our electronic health record system of record across all six clinics and the referral centre, exposed to partners through Epic's FHIR R4 API.
Our practice-management and scheduling data also lives in Epic and is accessible through the same FHIR interface.
Incoming documents are currently scanned into a shared network drive and manually filed by the medical records team before being keyed into Epic.
Our current phone system is a cloud contact-centre product from Five9, which front-desk staff use today for the 12,000 monthly patient calls.
A regional health information exchange, CareEverywhere, is used ad hoc by physicians to pull outside records, but is not integrated into our intake workflow.

## 3. Business Requirements

BR1. The solution must reduce the time medical records clerks spend keying referral and prior-authorisation documents into Epic by at least 50%.
BR2. The solution must reduce routine front-desk call volume by giving patients a self-service way to get appointment-prep and billing answers.
BR3. The solution should reduce the average time from document receipt to the document being visible in a patient's Epic chart.
BR4. Every clinical or coverage decision must remain with a licensed staff member; the assistant must never make an autonomous clinical or eligibility determination.
BR5. The solution could eventually extend to behavioural-health intake screening, though that is out of scope for this initial phase.

## 4. Functional Requirements

FR1. The system must accept incoming referral letters, prior-authorisation forms and lab results from fax, secure email and patient-portal upload.
FR2. The system must extract structured fields from each document, including patient identifiers, referring provider, requested service and supporting clinical notes.
FR3. The system must present each extracted document to a medical records clerk for review and correction before anything is written to Epic.
FR4. Approved documents must be written back to the correct patient chart in Epic through the FHIR R4 API, tagged with the extracting user and timestamp.
FR5. The patient-support assistant must answer common questions about appointment preparation, clinic locations, hours and accepted insurance plans.
FR6. The patient-support assistant must retrieve answers from our approved clinic policy and FAQ documents rather than generating unsourced medical guidance.
FR7. The patient-support assistant must recognise when a question requires clinical judgement or involves symptoms and must hand off to a human staff member.
FR8. The assistant must be available through our existing patient portal and, if feasible, as a widget on our public website.
FR9. Medical records clerks must be able to see a queue of documents awaiting review, prioritised by how long they have been waiting.
FR10. The system should flag documents where extraction confidence is low so clerks review those first.

## 5. Non-Functional Requirements

NFR1. The intake system must process at least 85,000 patient encounters worth of associated documents per month without a growing backlog.
NFR2. Document extraction results must be available to a reviewing clerk within 5 minutes of document receipt for 95% of documents.
NFR3. The solution must support approximately 1,200 clinical and administrative staff users plus patient-facing assistant traffic estimated at 85,000 conversations per month.
NFR4. The patient-support assistant must respond to a typical question within 4 seconds.
NFR5. The system must maintain 99.5% availability during clinic operating hours, 7am to 8pm Pacific, seven days a week.
NFR6. Every assistant answer and every extracted field must be traceable back to the source document or policy document it came from.

## 6. Integration Requirements

INT1. The intake system must integrate with Epic through the FHIR R4 API to write structured document data and retrieve patient context.
INT2. The intake system must accept inbound documents from our existing fax gateway, secure email inbox and patient-portal upload mechanism.
INT3. The patient-support assistant should integrate with Five9 so a handed-off conversation can be routed to an available front-desk agent with context preserved.
INT4. The assistant must authenticate patients through the existing patient-portal login rather than introducing a separate identity system.
INT5. The solution should be able to query the regional CareEverywhere health information exchange in a later phase, but that integration is not required for go-live.

## 7. Data Requirements

DATA1. All patient documents and extracted fields are protected health information and must be handled under our HIPAA policies at every stage.
DATA2. The assistant's knowledge base must be built only from clinic-approved policy, FAQ and appointment-prep documents, refreshed whenever those documents change.
DATA3. Extracted document data and assistant conversation logs must be retained for at least six years to satisfy state medical-records requirements.
DATA4. Conversation logs must be reviewable by compliance staff but must not be used to retrain or fine-tune any model without a separate, explicit approval process.
DATA5. Document images and extracted text must be encrypted at rest, separate from the assistant's conversational session data.

## 8. Security and Compliance

SEC1. The solution must comply with HIPAA, including a signed business associate agreement with any AI provider or subprocessor involved.
SEC2. All protected health information must be encrypted in transit and at rest using current industry-standard algorithms.
SEC3. Access to the document-review queue must be role-based and limited to authorised medical records staff, with supervisor audit visibility.
SEC4. Multi-factor authentication must be enforced for all staff accessing the intake review queue or extracted patient data.
SEC5. The solution must undergo a HIPAA security risk assessment before go-live.
SEC6. The patient-support assistant must never display another patient's information, even if a conversation is misrouted.

## 9. Technology Preferences

TECH1. Our infrastructure team runs existing workloads on Amazon Web Services and would prefer the new intake and assistant platform to run on AWS.
TECH2. We are open to a managed AI/ML service for document extraction and the assistant, as long as it can meet our HIPAA and data-handling requirements.
TECH3. Our two in-house developers have Python experience and would like to be able to maintain integration code after handover.

## 10. Delivery Constraints and Timeline

CON1. We would like a phased rollout starting with document intake within 24 weeks of contract signature, with the patient-support assistant following in a second phase.
CON2. The medical records team must be able to fall back to today's manual process at any time during the initial rollout if extraction quality is not trusted yet.
CON3. Our compliance officer must approve the assistant's response content and escalation rules before any patient-facing pilot begins.
CON4. Clinical and administrative staff can provide at most one subject-matter expert two days a week during the build; the delivery partner is expected to own the technical build.

## 11. Discovery Call Notes - 2026-09-02

Attendees: Chief Medical Information Officer, Director of Patient Access, Compliance Officer (Harborview Health Network); Engagement Manager, AI Solution Architect (delivery partner).
The Chief Medical Information Officer emphasised that clinician trust depends on every extracted field and every assistant answer being traceable to a source document.
The Compliance Officer confirmed a business associate agreement will be required with whichever AI provider is ultimately used and asked to review that agreement before any pilot.
The Director of Patient Access asked whether the assistant could eventually support Spanish-language conversations, given about 18% of patients prefer Spanish, but this was not committed to for the initial phase.
It is still unclear whether Epic's FHIR R4 API in our current sandbox environment supports writing structured referral data or only reading patient context; the CMIO will confirm with the Epic team.
No decision has been made yet on whether the assistant runs as a fully separate application or is embedded directly inside the existing patient portal.
`;

/** Harborview Health Network - clinical-document intake and patient-support assistant with a stated AWS preference. */
export const aiEnabledScenario: SeedScenario = {
  id: 'ai-enabled-clinical-intake-assistant',
  name: 'Clinical Intake and Patient Support Assistant',
  category: 'ai-enabled',
  tagline: 'Healthcare provider network automating document intake and patient support with a HIPAA-compliant RAG assistant on AWS.',
  customer: {
    customerName: 'Harborview Health Network',
    industry: 'Outpatient Healthcare',
    opportunityName: 'Clinical Intake and Patient Support Assistant',
    region: 'Portland Metro Area, Oregon, USA',
    engagementType: 'Phased AI solution program',
    notes:
      'Requirements gathered from an RFP issued 2026-08-19 and a follow-up discovery call on 2026-09-02 with the Chief Medical Information Officer, the Director of Patient Access and the Compliance Officer.',
  },
  requirementsText: REQUIREMENTS_TEXT,
  config: {
    cloudPlatform: 'aws',
    cloudSelectionMode: 'user-selected',
    expectedUsers: 1_200,
    targetRegions: ['Oregon, USA'],
    deliveryDeadlineWeeks: 24,
    environments: 3,
    aiProviderPreference: 'no-preference',
  },
};
