# ClaimsDesk Modernization Program - Integrated Scoping Package

*Meridian Assurance Group*

**Generated:** 2026-09-19 00:00 UTC · **AI mode:** Mock AI mode · **Export status:** Quality gate not run

> This document is an AI-assisted internal planning output based on customer requirements and stated assumptions. It requires review and validation by qualified sales, architecture, delivery, security, and commercial stakeholders. It is not a final quote, contractual commitment, or delivery guarantee.

## Table of contents

- [Change log](#change-log)

## Change log

### Expected users increased from 241,850 to 500,000

- **Previous value:** 241,850
- **New value:** 500,000
- **Recorded at:** 2026-09-19 00:00 UTC

Change: Expected users increased from 241,850 to 500,000. It affects 8 areas across Solution architecture, Data and integration strategy, Effort and timeline estimate and ROM commercials. Solution architecture - Volume-bound requirements must be regenerated: NFR_01, NFR_02, NFR_03, NFR_04 and NFR_06 state an availability, performance or scalability target. These targets were reviewed against the previous user volume and the architecture that realises them must be re-validated against the new one. Solution architecture - Scalability architecture must be regenerated: ARC_01, ARC_02, ARC_03, ARC_04, ARC_06, ARC_12 and 4 more cite NFR_01, NFR_02, NFR_03, NFR_04 and NFR_06, which state an availability, performance or scalability target. Compute scaling, load balancing and availability design are sized from the expected user volume. Solution architecture - Caching strategy must be regenerated: ARC_01 and ARC_27 make up the caching and content-delivery layer. Cache and content-delivery capacity is planned from concurrent usage. Solution architecture - Database sizing must be regenerated: ARC_04, ARC_19, ARC_21 and ARC_28 make up the data storage layer. Storage capacity, replicas and partitioning are sized from the user volume. Data and integration strategy - Volume-bound data and integration design must be regenerated: the "Backup and recovery" data topic cites NFR_01 and NFR_04, which state an availability, performance or scalability target. Throughput, synchronisation frequency and storage tiers planned against these targets scale with the user volume. Effort and timeline estimate - Performance testing effort must be regenerated: WS_04, DRV_17, DRV_18, DRV_19 and DRV_20 make up the non-functional hardening and performance testing drivers. Load, performance and resilience testing is scoped from the target user volume. Effort and timeline estimate - Cloud infrastructure effort and cost assumptions must be regenerated: WS_04, DRV_15 and DRV_16 make up the cloud infrastructure drivers. Infrastructure complexity and the cloud cost assumptions are banded by the expected user volume. ROM commercials - ROM estimate must be recalculated: WS_04 makes up the volume-dependent workstreams. The ROM is re-priced from the refreshed delivery effort of these workstreams. What stays untouched: Customer personas and user journeys (PRD): User volume does not change who the users are or what they need to do. Core workflows and capabilities (Functional scope): Functional behaviour is the same at any user volume; only the capacity behind it changes. Integrations that are not volume-bound (Data and integration strategy): Interfaces, protocols and authentication with existing systems do not depend on the number of users. AI use cases, safeguards and evaluation approach (AI solution approach): The AI solution pattern and its safeguards do not depend on the number of users. Reviewed requirement model (Reviewed scope model): A configuration change never rewrites reviewed requirements, assumptions or answers; they stay exactly as approved. Only the sections listed as affected are marked stale; reviewed content everywhere else is preserved and is never replaced without the reviewer choosing to regenerate it.

#### Affected sections

| Section | Area | Action | Status | Elements | Reason |
| --- | --- | --- | --- | --- | --- |
| Solution architecture | Volume-bound requirements | Regenerate | Pending | NFR_01, NFR_02, NFR_03, NFR_04, NFR_06 | NFR_01, NFR_02, NFR_03, NFR_04 and NFR_06 state an availability, performance or scalability target. These targets were reviewed against the previous user volume and the architecture that realises them must be re-validated against the new one. |
| Solution architecture | Scalability architecture | Regenerate | Pending | ARC_01, ARC_02, ARC_03, ARC_04, ARC_06, ARC_12, ARC_25, ARC_26, ARC_27, ARC_28 | ARC_01, ARC_02, ARC_03, ARC_04, ARC_06, ARC_12 and 4 more cite NFR_01, NFR_02, NFR_03, NFR_04 and NFR_06, which state an availability, performance or scalability target. Compute scaling, load balancing and availability design are sized from the expected user volume. |
| Solution architecture | Caching strategy | Regenerate | Pending | ARC_01, ARC_27 | ARC_01 and ARC_27 make up the caching and content-delivery layer. Cache and content-delivery capacity is planned from concurrent usage. |
| Solution architecture | Database sizing | Regenerate | Pending | ARC_04, ARC_19, ARC_21, ARC_28 | ARC_04, ARC_19, ARC_21 and ARC_28 make up the data storage layer. Storage capacity, replicas and partitioning are sized from the user volume. |
| Data and integration strategy | Volume-bound data and integration design | Regenerate | Pending | Backup and recovery | the "Backup and recovery" data topic cites NFR_01 and NFR_04, which state an availability, performance or scalability target. Throughput, synchronisation frequency and storage tiers planned against these targets scale with the user volume. |
| Effort and timeline estimate | Performance testing effort | Regenerate | Pending | WS_04, DRV_17, DRV_18, DRV_19, DRV_20 | WS_04, DRV_17, DRV_18, DRV_19 and DRV_20 make up the non-functional hardening and performance testing drivers. Load, performance and resilience testing is scoped from the target user volume. |
| Effort and timeline estimate | Cloud infrastructure effort and cost assumptions | Regenerate | Pending | WS_04, DRV_15, DRV_16 | WS_04, DRV_15 and DRV_16 make up the cloud infrastructure drivers. Infrastructure complexity and the cloud cost assumptions are banded by the expected user volume. |
| ROM commercials | ROM estimate | Recalculate | Pending | WS_04 | WS_04 makes up the volume-dependent workstreams. The ROM is re-priced from the refreshed delivery effort of these workstreams. |

#### Confirmed unaffected

| Section | Area | Reason |
| --- | --- | --- |
| PRD | Customer personas and user journeys | User volume does not change who the users are or what they need to do. |
| Functional scope | Core workflows and capabilities | Functional behaviour is the same at any user volume; only the capacity behind it changes. |
| Data and integration strategy | Integrations that are not volume-bound | Interfaces, protocols and authentication with existing systems do not depend on the number of users. |
| AI solution approach | AI use cases, safeguards and evaluation approach | The AI solution pattern and its safeguards do not depend on the number of users. |
| Reviewed scope model | Reviewed requirement model | A configuration change never rewrites reviewed requirements, assumptions or answers; they stay exactly as approved. |

### Contingency increased from 15% to 25%

- **Previous value:** 15%
- **New value:** 25%
- **Recorded at:** 2026-09-19 00:00 UTC

Change: Contingency increased from 15% to 25%. It affects 1 area across ROM commercials. ROM commercials - Contingency and ROM total must be recalculated: Contingency is a percentage of the subtotal and the ROM is subtotal plus contingency. What stays untouched: PRD narrative, personas and user journeys (PRD), Functional scope, modules and delivery packages (Functional scope), Cloud solution architecture (Solution architecture), Data strategy and integration architecture (Data and integration strategy), AI solution approach (AI solution approach) and Workstreams, effort and timeline (Effort and timeline estimate): Commercial parameters only price the estimated effort; scope, design and effort are not derived from them. Reviewed requirement model (Reviewed scope model): A configuration change never rewrites reviewed requirements, assumptions or answers; they stay exactly as approved. Only the sections listed as affected are marked stale; reviewed content everywhere else is preserved and is never replaced without the reviewer choosing to regenerate it.

#### Affected sections

| Section | Area | Action | Status | Elements | Reason |
| --- | --- | --- | --- | --- | --- |
| ROM commercials | Contingency and ROM total | Recalculate | Pending | WS_PH_1, WS_01, WS_02, WS_03, WS_04, WS_05, WS_06, WS_07, WS_PH_5, WS_PH_6 | Contingency is a percentage of the subtotal and the ROM is subtotal plus contingency. |

#### Confirmed unaffected

| Section | Area | Reason |
| --- | --- | --- |
| PRD | PRD narrative, personas and user journeys | Commercial parameters only price the estimated effort; scope, design and effort are not derived from them. |
| Functional scope | Functional scope, modules and delivery packages | Commercial parameters only price the estimated effort; scope, design and effort are not derived from them. |
| Solution architecture | Cloud solution architecture | Commercial parameters only price the estimated effort; scope, design and effort are not derived from them. |
| Data and integration strategy | Data strategy and integration architecture | Commercial parameters only price the estimated effort; scope, design and effort are not derived from them. |
| AI solution approach | AI solution approach | Commercial parameters only price the estimated effort; scope, design and effort are not derived from them. |
| Effort and timeline estimate | Workstreams, effort and timeline | Commercial parameters only price the estimated effort; scope, design and effort are not derived from them. |
| Reviewed scope model | Reviewed requirement model | A configuration change never rewrites reviewed requirements, assumptions or answers; they stay exactly as approved. |

### Priority of Functional requirement FR_05 "Policyholder self-service claim status" changed from Medium to Low

- **Previous value:** Medium
- **New value:** Low
- **Recorded at:** 2026-09-19 00:00 UTC

Change: Priority of Functional requirement FR_05 "Policyholder self-service claim status" changed from Medium to Low. It affects 4 areas across PRD, Functional scope, Effort and timeline estimate and ROM commercials. PRD - Requirement priorities in the PRD must be regenerated: the "User journeys or key workflows" section, the "Functional requirements" section, the "Requirement traceability" section and JNY_03 cite FR_05. The PRD restates the item, so its wording, priority and open points must match the reviewed scope model. Functional scope - Capability priority and delivery packaging must be regenerated: CAP_06 and ENH_04 cite FR_05. Capability scope, priority and acceptance criteria are derived from the item. Effort and timeline estimate - Workstreams and effort drivers must be regenerated: WS_01, DRV_06 and WS_04 cite FR_05; DRV_15 and EX_10 build on generated elements that cite it. Driver selection, complexity and delivery sequencing were suggested from the changed item. ROM commercials - ROM commercials must be recalculated: WS_01 and WS_04 cite FR_05. The ROM is the priced sum of these workstreams and is recalculated once their inputs are refreshed. What stays untouched: Cloud solution architecture (Solution architecture), Data strategy and integration architecture (Data and integration strategy) and AI solution approach (AI solution approach): Priority changes sequencing and coverage expectations, not the technical design of what is built. Other reviewed scope items (Reviewed scope model): Only the edited item changed; every other reviewed requirement, assumption and answer is kept as approved. Only the sections listed as affected are marked stale; reviewed content everywhere else is preserved and is never replaced without the reviewer choosing to regenerate it.

#### Affected sections

| Section | Area | Action | Status | Elements | Reason |
| --- | --- | --- | --- | --- | --- |
| PRD | Requirement priorities in the PRD | Regenerate | Pending | journeys, functionalRequirements, traceability, JNY_03 | the "User journeys or key workflows" section, the "Functional requirements" section, the "Requirement traceability" section and JNY_03 cite FR_05. The PRD restates the item, so its wording, priority and open points must match the reviewed scope model. |
| Functional scope | Capability priority and delivery packaging | Regenerate | Pending | CAP_06, ENH_04 | CAP_06 and ENH_04 cite FR_05. Capability scope, priority and acceptance criteria are derived from the item. |
| Effort and timeline estimate | Workstreams and effort drivers | Regenerate | Pending | WS_01, DRV_06, WS_04, DRV_15, EX_10 | WS_01, DRV_06 and WS_04 cite FR_05; DRV_15 and EX_10 build on generated elements that cite it. Driver selection, complexity and delivery sequencing were suggested from the changed item. |
| ROM commercials | ROM commercials | Recalculate | Pending | WS_01, WS_04 | WS_01 and WS_04 cite FR_05. The ROM is the priced sum of these workstreams and is recalculated once their inputs are refreshed. |

#### Confirmed unaffected

| Section | Area | Reason |
| --- | --- | --- |
| Solution architecture | Cloud solution architecture | Priority changes sequencing and coverage expectations, not the technical design of what is built. |
| Data and integration strategy | Data strategy and integration architecture | Priority changes sequencing and coverage expectations, not the technical design of what is built. |
| AI solution approach | AI solution approach | Priority changes sequencing and coverage expectations, not the technical design of what is built. |
| Reviewed scope model | Other reviewed scope items | Only the edited item changed; every other reviewed requirement, assumption and answer is kept as approved. |

> This document is an AI-assisted internal planning output based on customer requirements and stated assumptions. It requires review and validation by qualified sales, architecture, delivery, security, and commercial stakeholders. It is not a final quote, contractual commitment, or delivery guarantee.