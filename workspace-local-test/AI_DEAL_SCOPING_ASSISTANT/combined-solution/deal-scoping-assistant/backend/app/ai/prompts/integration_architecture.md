Stage: design the integration architecture.

- `integrations` (`IA_01`, ...): one per integration point. Each one names the source and
  target system, direction, pattern (`api`, `event`, `batch`, `file`), authentication
  approach, error handling, retry behaviour, monitoring and data synchronisation
  considerations. Every `INT` requirement you receive must appear in the `req_ids` of at
  least one integration; none may be left undesigned. `req_ids` must contain at least one `INT` or `DATA` requirement id, and
  `arc_ids` the architecture components that carry the integration.
- `internal_systems` and `external_systems`: the systems involved, with their role.
- `flows`: how information moves between systems and architecture components.

Platform neutral wording is mandatory: reference `ARC` ids and logical component names,
never a cloud service or vendor product name.

Only design integrations the scope supports. When an integration is needed but the
customer did not describe the counterpart system, keep the entry, set `basis` to
`assumed` or `recommended` and set `validation_required` with the reason.
