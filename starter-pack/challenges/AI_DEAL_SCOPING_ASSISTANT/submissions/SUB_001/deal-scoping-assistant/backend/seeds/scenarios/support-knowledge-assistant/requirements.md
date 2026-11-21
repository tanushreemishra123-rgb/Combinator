# Email Thread — Support Knowledge Assistant

Forwarded by the account manager. Three messages, oldest last.

---

**From:** Dana Okonkwo, VP Customer Support, Arbormill Software
**To:** [account manager]
**Cc:** Rafael Sunde (Director of Engineering), Priya Menon (Data Protection Officer)
**Date:** 18 February 2026, 16:42
**Subject:** RE: RE: Support assistant — answers to your questions

Thanks, answers inline against your numbered list.

1. **Volumes.** 41,000 tickets last year, growing about 18% year on year. 62 agents across
   Dublin and Austin, plus 11 escalation engineers. Peak is 280 tickets a day after a release.
2. **Content.** Product documentation is 2,400 pages in Confluence Cloud and a public docs site
   built from Markdown in GitHub. Closed tickets are in Zendesk, about 96,000 of them going back
   six years. There are also 340 internal runbooks in SharePoint that engineering maintains.
3. **What we want it to do**, in priority order:
   - Draft a reply for the agent, grounded in documentation and similar past tickets, with the
     sources shown. The agent edits and sends. Nothing goes to a customer unreviewed.
   - Classify incoming tickets by product area and by type (bug, how-to, billing, outage) and
     route to the right queue. Today this is manual and about 22% of tickets are re-routed at
     least once.
   - Suggest a priority. Rafael thinks priority should stay a rule, not a model output, because
     our SLA tiers are contractual. Happy to be argued with.
   - Surface the three most similar past tickets with their resolution.
4. **What we do not want.** No customer-facing chatbot in this phase. We tried one in 2024 with
   another vendor and the deflection numbers were not real.
5. **Success measure.** Average handle time from 14 minutes to under 9, and re-routing under 5%.
   Rafael wants a number for answer quality too but we do not have a baseline.
6. **Cloud.** We genuinely do not have a preference. We run on a mix today — the product is on
   one provider, our data tooling on another, and the contracts renew at different times. We would
   like your recommendation and the reasoning, and we would like to understand what we would be
   locked into.
7. **Timing.** We would like something in front of agents by the end of Q3 2026. It does not
   have to do everything on day one.

Priya has added her points below in the previous message.

---

**From:** Priya Menon, Data Protection Officer, Arbormill Software
**To:** Dana Okonkwo
**Date:** 18 February 2026, 11:20
**Subject:** RE: Support assistant — data protection points

Dana, before this goes further, the following are not negotiable from my side:

1. Ticket bodies contain customer personal data and, in maybe 5% of cases, credentials and
   internal system names that customers paste into descriptions. Anything we send to a model
   must be redacted first, and we need evidence that redaction happened.
2. About 30% of our customers are EU-based and three of our enterprise contracts contain an
   EU data-residency clause. I need to know where inference happens and where anything is
   retained. If a provider retains prompts for abuse monitoring outside the EU, that is a problem.
3. We need to be able to answer, for any generated draft, which documents it used and when the
   model was called. Retention of that record: 24 months.
4. No training on our customer data by any third party. This needs to be contractual, not a
   setting someone can toggle.
5. I want a documented process for what happens when the assistant produces something wrong and
   an agent sends it. Who is accountable, and how do we detect it.

I am not opposed to this. I want it designed so I can defend it.

---

**From:** Dana Okonkwo, VP Customer Support, Arbormill Software
**To:** [account manager]
**Date:** 11 February 2026, 09:05
**Subject:** Support assistant — initial ask

Hello,

Following our conversation at the user conference, I would like a proposal for a support
assistant for our agents.

Background: Arbormill sells project-control software to construction and infrastructure firms.
About 1,900 customer accounts, 40 people in support and engineering escalation. Our agents spend
most of their time finding the right documentation page or the ticket where someone solved the
same thing two years ago. Our documentation is good; finding things in it is not.

What I imagine is a panel next to the ticket in Zendesk that shows a suggested reply, the
sources it used, and similar past tickets. The agent stays in control.

Practical things I know we will need to deal with:

- Documentation changes with every two-week release, so whatever indexes it has to keep up.
  We have had situations where an agent quoted a page that was superseded.
- Our older tickets contain advice that is now wrong. I do not know how you handle that.
- We have four products and the terminology overlaps. "Schedule" means something different in
  two of them.
- Somebody will ask about accuracy and I will need a defensible answer, not a demo.

Budget: we have approval to spend in the mid six figures over two years, but I would rather
see the shape of the solution first. We have no in-house machine-learning people. We have a
strong platform team of nine.

Happy to arrange a working session with Rafael and Priya.

Dana
