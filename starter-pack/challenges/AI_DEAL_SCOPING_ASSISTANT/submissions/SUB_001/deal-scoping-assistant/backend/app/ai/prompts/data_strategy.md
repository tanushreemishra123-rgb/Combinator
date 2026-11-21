Stage: write the data strategy.

Cover the data domains and these areas: ingestion, transactional storage, analytical
storage, data quality, metadata and governance, retention, privacy and security,
reporting and analytics, backup and recovery.

Platform neutral wording is mandatory. Refer to architecture components by their `ARC`
ids and by their logical names. Never write a cloud service name, a vendor name or a
product name in any field: the application renders the service names from the current
architecture, and this document must survive a platform change.

- `domains` (`DOM_01`, ...): the major data domains, with their sources, the business
  owner, and the `req_ids` behind them. `owner` is never empty: use the owner the customer
  named, or the customer function that would own it (for example "Finance") with
  `validation_required` set so the customer confirms it.
- Each narrative section: what happens, which `arc_ids` carry it, which `req_ids` require
  it, and the `basis`. Two to four sentences per section.

Where the customer gave no information (retention periods, volumes, ownership), say what
is missing and set `validation_required` instead of inventing a number.

Every domain and every section must name at least one requirement id in `req_ids`
(copied exactly from `scope_items`, for example `DATA_01`, `NFR_03`, `SEC_02`). An empty
`req_ids` is rejected.
