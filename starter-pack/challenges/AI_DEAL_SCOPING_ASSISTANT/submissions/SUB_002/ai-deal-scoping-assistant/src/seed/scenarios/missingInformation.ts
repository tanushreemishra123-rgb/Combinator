/**
 * Seed scenario 4 of 4: missing information.
 * Short, vague discovery-call notes for a membership organisation that wants "a modern member app
 * with some AI" but has not yet nailed down volumes, deadline, environments, integrations,
 * compliance scope, cloud preference or budget - the analyzer should raise gaps and questions and
 * report lower confidence rather than inventing numbers.
 */
import type { SeedScenario } from '..';

const REQUIREMENTS_TEXT = `# Discovery Call Notes - National Horticultural Traders Association

## Call details

Call date: 2026-09-08.
Attendees: Executive Director, Membership Coordinator (National Horticultural Traders Association); Engagement Manager (delivery partner).
This was a first exploratory call, not a formal RFP; the association does not have a written requirements document yet.
The Executive Director opened by saying "we just know our current member experience feels dated and we want something modern with some AI in it."

## Organisation context

The National Horticultural Traders Association is a trade membership body for wholesale nurseries, garden retailers and landscape suppliers.
Members currently manage their profile, pay dues and browse the member directory through an old membership portal that the Executive Director could not name precisely, only saying "it might be called MemberSuite, or something similar, our office manager set it up years ago."
The Membership Coordinator said renewals are currently tracked "mostly by email and a shared spreadsheet, if I am honest."
Nobody on the call could say how many active members the association currently has; the Executive Director guessed "somewhere between a couple thousand and maybe five thousand, but I would need to check with finance."
The association's fiscal year runs January to December and dues renewals are meant to happen annually, though the Membership Coordinator admitted "a lot of members just let it lapse and we chase them later."

## What they are looking for

They want a modern member app that lets members log in, update their profile and renew their membership online.
They want some kind of AI feature but were not specific; the Executive Director said "maybe a chatbot that can answer member questions, or something that helps us write newsletters, we are open to ideas."
The Membership Coordinator would like members to be able to search the directory of other members more easily than today.
They mentioned wanting event registration for their annual trade show but were not sure if that should be part of this project or handled separately.
They would like renewal reminders to go out automatically instead of the Membership Coordinator tracking them manually.

## Things nobody could answer on the call

The Executive Director could not confirm how many members would actually use the new app versus staying on email and phone.
Nobody could say whether they have a target launch date; the Executive Director said only "sometime next year would be nice, but there is no hard deadline that I know of."
It is unclear which systems, if any, the new app would need to connect to beyond "whatever we are using for dues payments right now," which nobody on the call could name with certainty.
Nobody mentioned how many environments (development, testing, production) they would expect or currently have, and it was not asked.
No compliance or data-protection requirements were mentioned; when asked in passing whether they handle payment card data directly, the Executive Director said "I honestly am not sure, I think our current vendor handles that part."
Nobody expressed a cloud platform preference; the Executive Director said "we do not really have technical staff, so whatever you all think is best."
No budget range was discussed on this call; the Executive Director said pricing would be a separate conversation once they understand what is possible.
It is unclear whether the association wants a mobile app, a responsive website, or both.
Nobody could say whether any existing single sign-on or shared login system should be reused, since the association does not appear to have one today.

## Loosely stated requirements

The Executive Director said the new experience "should probably let members pay their dues online without calling the office."
The Membership Coordinator said it "would be nice" if members could see other members in their region or trade category.
The Executive Director said the chatbot idea "should only answer basic questions and not make anything up," but did not describe what a basic question looks like.
Both attendees agreed the current member directory search is frustrating but could not describe specifically what makes it hard to use.
The Executive Director mentioned they might want board members to have some kind of special access to reports, but was not able to describe what those reports would contain.

## Additional colour from the call

The Executive Director mentioned the board approved "some money" for this project at a recent meeting but did not state a figure or say whether it covers build, licensing or both.
The Membership Coordinator said a handful of members have emailed asking "why can't I just update my address myself" which is part of why this came up now.
Neither attendee could say whether the existing membership portal has an API or any way to export data; the Executive Director said "I genuinely do not know, that is a good question for our office manager."
The Executive Director said the association has about six staff in total and none of them are technical, so day-to-day support after launch would likely need to sit with the delivery partner or a future hire.
When asked about competitors or peer associations with a similar app, the Membership Coordinator mentioned "a couple of other trade groups have something like this" but could not name them or describe what they liked about those apps.
The call ended with the Executive Director asking "what would you even need from us to give us a rough idea of cost," which the Engagement Manager said would be the subject of a follow-up call once open items are resolved.

## What happens next

The delivery partner will send a short list of clarifying questions covering member count, systems, timeline and budget before any proposal can be drafted.
The Executive Director agreed to loop in the office manager, who set up the original membership portal, for the next call.
The Membership Coordinator agreed to check whether finance can produce an approximate current member count before the next call.
No commitments were made on scope, timeline or cost during this call; everything discussed here is directional only.

## Follow-ups the delivery partner needs from the customer

Confirm the actual current member count and the platform name and vendor for the existing membership system.
Confirm whether event registration for the annual trade show is in scope for this engagement or a separate future project.
Confirm whether the association directly handles payment card data or whether an existing payment vendor is fully responsible for that.
Confirm whether there is any target date, even an approximate one, and any budget range the association has in mind.
Confirm who on the association's side, if anyone, can act as a technical or business point of contact once the project starts.
Confirm whether the existing membership portal exposes any API or export mechanism that a new app could build on.
`;

/** National Horticultural Traders Association - vague discovery notes that omit almost every planning input. */
export const missingInformationScenario: SeedScenario = {
  id: 'missing-information-member-app',
  name: 'Member Experience Modernisation (Early Discovery)',
  category: 'missing-information',
  tagline: 'Membership association exploring "a modern member app with some AI" before any volumes, deadline or budget are known.',
  customer: {
    customerName: 'National Horticultural Traders Association',
    industry: 'Trade Membership Association',
    opportunityName: 'Member Experience Modernisation',
    region: 'United States (unspecified)',
    engagementType: 'Exploratory - not yet scoped',
    notes: 'Notes from a first exploratory discovery call on 2026-09-08; no RFP or written requirements exist yet.',
  },
  requirementsText: REQUIREMENTS_TEXT,
  config: {
    cloudPlatform: null,
    cloudSelectionMode: 'recommend',
    expectedUsers: null,
    targetRegions: [],
    deliveryDeadlineWeeks: null,
    environments: null,
    aiProviderPreference: 'no-preference',
  },
};
