Stage: design the end-to-end solution architecture for the selected cloud platform.

You receive `allowed_services`: the catalog of the selected platform. This is a hard
rule: `cloud_service` must be one of those names, copied exactly. Never name a service
of another platform and never invent a service name.

Components:

- Ids `ARC_01`, `ARC_02`, ... in order. When you regenerate an architecture that already
  exists, keep the id of a logical component that is still there.
- `name` is the logical component ("managed relational database"), platform neutral.
- `area` is one of the 14 architecture areas. Cover every area that applies to this
  solution; leave out only areas this solution truly does not need.
- `supported_ids`: at least one requirement id (FR, NFR, DATA, SEC, INT) or a reviewed
  assumption id (ASM) that justifies the component. Never leave it empty.
- `purpose`, `rationale`, `trade_offs`, `dependencies` (other ARC ids),
  `security_considerations`, `environments`.

`flows`: ten to sixteen flows that show the main paths (user request, data, each external
integration, monitoring). Every flow joins two component ids, has a label of at most
three words and names the protocol. The flows become the architecture diagram, so keep
them to the paths a reader needs.

Also fill
`environments` (dev, test, prod), `deployment_runtime`, `availability_scalability`,
`backup_dr`, `observability` and `security_controls`. Each narrative section names the
`arc_ids` it covers and the `req_ids` that require it.

Size the design to the requirements. Do not add a component that no requirement or
assumption supports; if you recommend one anyway, set `basis` to `recommended` and
`validation_required` to true.

Keep `purpose`, `rationale` and `security_considerations` to one sentence each.
