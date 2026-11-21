"""Domain objects used by the package tests. Kept explicit so the tests read as data."""

import zlib
from datetime import UTC, datetime

from app.domain.artifacts import (
    AiStrategy,
    AiUseCase,
    Architecture,
    ArchitectureArea,
    ArchitectureComponent,
    ArtifactKind,
    Basis,
    Capability,
    Complexity,
    DataDomain,
    DataStrategy,
    Environments,
    EstimateDrivers,
    ExecutiveSummary,
    Flow,
    FrameworkRecommendation,
    FunctionalScope,
    IntegrationArchitecture,
    IntegrationItem,
    NarrativeSection,
    Prd,
    PrdRequirement,
    ProcessingClass,
    ProviderOption,
    ProviderPlatformScope,
    ScopeClass,
    Statement,
    SystemRef,
    Workstream,
)
from app.domain.estimation import (
    ConfidenceLevel,
    Estimate,
    MissingInput,
    RomRange,
    TraceEntry,
    TraceInput,
    WorkstreamEstimate,
)
from app.domain.quality import (
    CheckId,
    CheckStatus,
    ExportStatus,
    QualityCheckResult,
    QualityReport,
    QualitySummary,
    Severity,
)
from app.domain.scope import (
    AnswerStatus,
    AssumptionDetails,
    CloudPlatform,
    IntegrationDetails,
    IntegrationDirection,
    IntegrationPattern,
    ItemType,
    NfrCategory,
    NfrDetails,
    Origin,
    PlatformMode,
    Priority,
    QuestionDetails,
    ScopeItem,
    ScopeItemDetails,
    SessionConfig,
    SessionRead,
    SourceRef,
)
from app.package.inputs import PackageArtifacts, PackageMeta
from app.traceability.coverage import (
    CoverageCell,
    CoverageColumn,
    CoverageReport,
    CoverageRow,
    UnsupportedAddition,
    counts_in_percentage,
)

NOW = datetime(2026, 9, 17, 10, 0, tzinfo=UTC)
LONG_TEXT = (
    "This capability description is deliberately very long so that the renderers have to wrap it "
    "inside a single table cell across several lines without losing any of its words, which is "
    "exactly what a reviewer needs when a customer requirement runs to a full paragraph of prose. "
) * 3


# --- coverage ----------------------------------------------------------------


def coverage_report() -> CoverageReport:
    def row(item: ScopeItem, capability_ids: list[str], prd_ids: list[str]) -> CoverageRow:
        cells = [
            CoverageCell(column=column, element_ids=[], covered=False) for column in CoverageColumn
        ]
        by_column = {cell.column: cell for cell in cells}
        by_column[CoverageColumn.CAPABILITY] = CoverageCell(
            column=CoverageColumn.CAPABILITY,
            element_ids=capability_ids,
            covered=bool(capability_ids),
        )
        by_column[CoverageColumn.PRD] = CoverageCell(
            column=CoverageColumn.PRD, element_ids=prd_ids, covered=bool(prd_ids)
        )
        return CoverageRow(
            item_id=item.id,
            item_type=item.type,
            title=item.title,
            priority=item.priority,
            status=item.status,
            counts_in_percentage=counts_in_percentage(item),
            covered=bool(capability_ids),
            cells=list(by_column.values()),
        )

    items = {item.id: item for item in scope_items()}
    return CoverageReport(
        rows=[
            row(items["FR_01"], ["CAP_01"], ["FR_01"]),
            row(items["NFR_01"], [], []),
        ],
        counted_count=2,
        covered_count=1,
        coverage_pct=50.0,
        uncovered_ids=["NFR_01"],
        high_priority_count=2,
        high_priority_covered_count=1,
        high_priority_pct=50.0,
        high_priority_uncovered_ids=["NFR_01"],
        unsupported_additions=[
            UnsupportedAddition(
                artifact=ArtifactKind.FUNCTIONAL_SCOPE,
                element_id="ENH_01",
                element_kind="recommended enhancement",
                referenced_ids=[],
                reason="references no requirement id",
            )
        ],
    )


# --- scope -------------------------------------------------------------------


def _ref(quote: str) -> SourceRef:
    return SourceRef(document_id="D1", segment_id="D1.S1", quote=quote, verified=True)


def scope_items() -> list[ScopeItem]:
    common = {"created_at": NOW, "updated_at": NOW}
    return [
        ScopeItem(
            id="BR_01",
            type=ItemType.BUSINESS_OBJECTIVE,
            title="Cut onboarding time",
            description="Reduce customer onboarding from ten days to two.",
            priority=Priority.MUST,
            origin=Origin.CUSTOMER_STATED,
            source_refs=[_ref("onboarding takes ten days today")],
            **common,
        ),
        ScopeItem(
            id="FR_01",
            type=ItemType.FUNCTIONAL_REQUIREMENT,
            title="Guided onboarding",
            description=LONG_TEXT,
            priority=Priority.HIGH,
            origin=Origin.CUSTOMER_STATED,
            source_refs=[_ref("we need a guided onboarding flow")],
            **common,
        ),
        ScopeItem(
            id="NFR_01",
            type=ItemType.NON_FUNCTIONAL_REQUIREMENT,
            title="Scale to 500k users",
            priority=Priority.HIGH,
            origin=Origin.AI_INFERRED,
            source_refs=[_ref("half a million customers")],
            details=ScopeItemDetails(nfr=NfrDetails(category=NfrCategory.SCALABILITY)),
            **common,
        ),
        ScopeItem(
            id="INT_01",
            type=ItemType.INTEGRATION,
            title="CRM integration",
            priority=Priority.HIGH,
            origin=Origin.CUSTOMER_STATED,
            source_refs=[_ref("integrate with our CRM")],
            details=ScopeItemDetails(
                integration=IntegrationDetails(
                    system="Salesforce",
                    direction=IntegrationDirection.BIDIRECTIONAL,
                    pattern=IntegrationPattern.API,
                )
            ),
            **common,
        ),
        ScopeItem(
            id="Q_01",
            type=ItemType.CLARIFICATION_QUESTION,
            title="Which CRM edition?",
            priority=Priority.HIGH,
            origin=Origin.AI_INFERRED,
            source_refs=[_ref("integrate with our CRM")],
            details=ScopeItemDetails(
                question=QuestionDetails(
                    why_it_matters="The edition decides the API limits.",
                    affected_ids=["INT_01"],
                    answer_status=AnswerStatus.OPEN,
                )
            ),
            **common,
        ),
        ScopeItem(
            id="ASM_01",
            type=ItemType.ASSUMPTION,
            title="CRM API is available",
            priority=Priority.HIGH,
            origin=Origin.ASSUMED,
            related_ids=["Q_01"],
            absence_note="Assumed while the question is open.",
            details=ScopeItemDetails(assumption=AssumptionDetails(impact_if_wrong="Rework")),
            **common,
        ),
    ]


def session() -> SessionRead:
    return SessionRead(
        id="S1",
        name="Acme onboarding",
        customer_name="Acme Corp / Nordics",
        opportunity_context="Replace the manual onboarding desk.",
        cloud_platform=CloudPlatform.AWS,
        platform_mode=PlatformMode.SELECTED,
        config=SessionConfig(),
        scope_version=3,
        scope_status="approved",
        ai_mode="mock",
        created_at=NOW,
        updated_at=NOW,
    )


# --- artifacts ---------------------------------------------------------------


def _narrative(text: str, arc_ids: list[str]) -> NarrativeSection:
    return NarrativeSection(text=text, arc_ids=arc_ids, req_ids=["FR_01"], basis=Basis.INFERRED)


def architecture() -> Architecture:
    return Architecture(
        platform=CloudPlatform.AWS,
        components=[
            ArchitectureComponent(
                id="ARC_01",
                name='Onboarding web app [primary] | "portal"',
                area=ArchitectureArea.USER_FACING_APPLICATIONS,
                cloud_service="Amazon CloudFront + S3",
                purpose="Serve the onboarding portal.",
                supported_ids=["FR_01"],
                rationale="Static hosting with a global edge.",
                basis=Basis.CUSTOMER,
            ),
            ArchitectureComponent(
                id="ARC_02",
                name="Customer database",
                area=ArchitectureArea.DATABASES_AND_STORAGE,
                cloud_service="Amazon RDS for PostgreSQL",
                purpose="Store customer profiles.",
                supported_ids=["NFR_01", "ASM_01"],
                rationale="Managed PostgreSQL with backups.",
                basis=Basis.ASSUMED,
                validation_required=True,
                validation_reason="ASM_01 is not confirmed.",
            ),
            ArchitectureComponent(
                id="ARC_03",
                name="Integration gateway",
                area=ArchitectureArea.INTEGRATION_COMPONENTS,
                cloud_service="Amazon API Gateway",
                purpose="Expose integration endpoints.",
                supported_ids=["INT_01"],
                rationale="Managed throttling and auth.",
                basis=Basis.CUSTOMER,
            ),
        ],
        flows=[
            Flow(from_id="ARC_01", to_id="ARC_02", label="reads | writes [profiles]"),
            Flow(from_id="ARC_03", to_id="Salesforce CRM", label="syncs accounts"),
        ],
        environments=Environments(dev="Sandbox account", test="Shared", prod="Dedicated"),
        deployment_runtime=_narrative("Containers on ECS.", ["ARC_01"]),
        availability_scalability=_narrative("Multi-AZ.", ["ARC_02"]),
        backup_dr=_narrative("Daily snapshots.", ["ARC_02"]),
        observability=_narrative("CloudWatch dashboards.", []),
        security_controls=_narrative("KMS everywhere.", ["ARC_02"]),
    )


def integration_architecture() -> IntegrationArchitecture:
    return IntegrationArchitecture(
        integrations=[
            IntegrationItem(
                id="IA_01",
                name="CRM account sync",
                source_system="Onboarding platform",
                target_system="Salesforce CRM",
                direction=IntegrationDirection.BIDIRECTIONAL,
                pattern=IntegrationPattern.API,
                auth_approach="OAuth 2.0 client credentials",
                error_handling="Dead-letter queue",
                retry_behavior="Exponential backoff",
                monitoring="CloudWatch alarms",
                sync_considerations="Last-write-wins",
                arc_ids=["ARC_03"],
                req_ids=["INT_01"],
                basis=Basis.CUSTOMER,
            )
        ],
        internal_systems=[
            SystemRef(
                name="Onboarding platform",
                description="The new solution",
                req_ids=["FR_01"],
                basis=Basis.CUSTOMER,
            )
        ],
        external_systems=[
            SystemRef(
                name="Salesforce CRM",
                description="System of record",
                req_ids=["INT_01"],
                basis=Basis.CUSTOMER,
            )
        ],
        flows=[Flow(from_id="Onboarding platform", to_id="Salesforce CRM", label="accounts")],
    )


def artifacts() -> PackageArtifacts:
    statement = Statement(text="Reduce onboarding cost.", req_ids=["BR_01"], basis=Basis.CUSTOMER)
    return PackageArtifacts(
        executive_summary=ExecutiveSummary(
            overview="A cloud onboarding platform on AWS.",
            customer_objectives=[statement],
            solution_highlights=[
                Statement(text="Guided onboarding", req_ids=["FR_01"], basis=Basis.CUSTOMER)
            ],
            commercial_summary="ROM 400k to 600k USD.",
            key_risks=[Statement(text="CRM API unknown", req_ids=["INT_01"], basis=Basis.INFERRED)],
            next_steps=[Statement(text="Confirm ASM_01", req_ids=["ASM_01"], basis=Basis.ASSUMED)],
        ),
        prd=Prd(
            overview="Onboarding platform.",
            business_problem="Onboarding takes ten days.",
            objectives=[statement],
            functional_requirements=[
                PrdRequirement(
                    req_id="FR_01",
                    statement=LONG_TEXT,
                    acceptance_conditions=["Completed in under two days"],
                    req_ids=["FR_01"],
                    basis=Basis.CUSTOMER,
                )
            ],
            traceability=[],
        ),
        functional_scope=FunctionalScope(
            capabilities=[
                Capability(
                    id="CAP_01",
                    name="Customer onboarding",
                    description=LONG_TEXT,
                    included_req_ids=["FR_01", "INT_01"],
                    priority=Priority.HIGH,
                    scope_class=ScopeClass.CUSTOMER_REQUESTED,
                    workstream_id="WS_01",
                    basis=Basis.CUSTOMER,
                )
            ],
            workstreams=[
                Workstream(
                    id="WS_01",
                    name="Experience",
                    capability_ids=["CAP_01"],
                    req_ids=["FR_01"],
                    basis=Basis.CUSTOMER,
                )
            ],
        ),
        architecture=architecture(),
        data_strategy=DataStrategy(
            domains=[
                DataDomain(
                    id="DOM_01",
                    name="Customer",
                    description="Profiles",
                    sources=["Salesforce CRM"],
                    req_ids=["DATA_01"],
                    basis=Basis.INFERRED,
                )
            ],
            ingestion=_narrative("Batch load from the CRM.", ["ARC_03"]),
            transactional_storage=_narrative("Relational store.", ["ARC_02"]),
            analytical_storage=_narrative("Warehouse.", ["ARC_02"]),
            quality=_narrative("Validation rules.", []),
            metadata_governance=_narrative("Catalogue.", []),
            retention=_narrative("Seven years.", ["ARC_02"]),
            privacy_security=_narrative("Encrypted at rest.", ["ARC_02"]),
            reporting_analytics=_narrative("Dashboards.", []),
            backup_recovery=_narrative("Point-in-time restore.", ["ARC_02"]),
        ),
        integration_architecture=integration_architecture(),
        ai_strategy=AiStrategy(
            ai_requirements=[
                Statement(
                    text="Answers cited",
                    req_ids=["FR_01"],
                    basis=Basis.RECOMMENDED,
                    validation_required=True,
                    validation_reason="Recommended, not stated.",
                )
            ],
            use_cases=[
                AiUseCase(
                    id="AI_01",
                    name="Document extraction",
                    description="Extract fields from uploaded documents.",
                    processing_class=ProcessingClass.AI,
                    pattern="Structured extraction",
                    model_options=["Claude", "Gemini"],
                    retrieval_required=False,
                    evaluation="Golden set",
                    responsible_ai_safety="PII redaction",
                    monitoring_feedback="Reviewer feedback loop",
                    human_review="Reviewer approves every extraction",
                    data_privacy="No training on customer data",
                    req_ids=["FR_01"],
                    basis=Basis.RECOMMENDED,
                )
            ],
            architecture_pattern="Structured extraction with human review",
            provider_options=[
                ProviderOption(
                    platform=ProviderPlatformScope.AWS,
                    provider="Amazon Bedrock",
                    models=["Claude"],
                    rationale="Native to the selected platform.",
                ),
                ProviderOption(
                    platform=ProviderPlatformScope.GCP,
                    provider="Vertex AI",
                    models=["Gemini"],
                    rationale="Not the selected platform.",
                ),
            ],
            framework_recommendations=[
                FrameworkRecommendation(
                    name="LangGraph",
                    purpose="Stage orchestration",
                    rationale="Deterministic validate-and-repair loops.",
                    req_ids=["FR_01"],
                    basis=Basis.RECOMMENDED,
                )
            ],
        ),
        estimate_drivers=EstimateDrivers(
            delivery_risks=[
                Statement(text="CRM readiness", req_ids=["INT_01"], basis=Basis.INFERRED)
            ],
            estimation_assumptions=[
                Statement(text="Team of five", req_ids=["ASM_01"], basis=Basis.ASSUMED)
            ],
        ),
    )


def estimate() -> Estimate:
    return Estimate(
        workstreams=[
            WorkstreamEstimate(
                workstream_id="WS_01",
                name="Experience",
                req_ids=["FR_01"],
                roles=["Engineer"],
                complexity=Complexity.MEDIUM,
                effort_low=16,
                effort_high=24,
                confidence=ConfidenceLevel.MEDIUM,
                limitations=["CRM edition unknown"],
                trace=[
                    TraceEntry(
                        label="Unit effort",
                        formula="base x factors",
                        inputs=[TraceInput(name="base", value="12")],
                        result=20.0,
                    )
                ],
            )
        ],
        phases=[],
        effort_low=16,
        effort_high=24,
        effort_incl_contingency_low=18.4,
        effort_incl_contingency_high=27.6,
        timeline_weeks_low=8,
        timeline_weeks_high=12,
        rom=RomRange(
            amount_low=400000,
            amount_high=600000,
            currency="USD",
            rate_basis="role_mix",
            contingency_pct=15,
        ),
        overall_confidence=ConfidenceLevel.MEDIUM,
        confidence_limitations=["One open question"],
        missing_inputs=[
            MissingInput(
                key="expected_users",
                impact="Infra sizing unconfirmed",
                affected_components=["ARC_02"],
            )
        ],
        rate_card_id="RC_01",
        config_hash="abc123",
        trace=[
            TraceEntry(
                label="ROM",
                formula="effort x rate x (1 + contingency)",
                inputs=[TraceInput(name="rate", value="2500")],
                result=460000.0,
            )
        ],
        calculated_at=NOW,
    )


def quality_report() -> QualityReport:
    return QualityReport(
        session_id="S1",
        scope_version=3,
        checks=[
            QualityCheckResult(
                id=CheckId.QG_08,
                name="Unresolved clarification questions",
                severity=Severity.WARNING,
                status=CheckStatus.WARNING,
                message="One question is still open.",
                affected_ids=["Q_01"],
                remediation="Ask the customer.",
            ),
            QualityCheckResult(
                id=CheckId.QG_13,
                name="Cross-document consistency",
                severity=Severity.ERROR,
                status=CheckStatus.FAILED,
                message="DATA_01 is referenced but not approved.",
                affected_ids=["DOM_01"],
            ),
        ],
        summary=QualitySummary(
            coverage_pct=80.0,
            uncovered_requirements=1,
            unresolved_questions=1,
            unsupported_recommendations=1,
            estimate_confidence=ConfidenceLevel.MEDIUM,
            export_status=ExportStatus.REVIEW_REQUIRED,
        ),
        created_at=NOW,
    )


def meta() -> PackageMeta:
    return PackageMeta.from_session(session())


def png_bytes(width: int = 8, height: int = 4) -> bytes:
    """A real, tiny PNG so the DOCX and PDF writers embed something valid."""

    def chunk(tag: bytes, payload: bytes) -> bytes:
        body = tag + payload
        return len(payload).to_bytes(4, "big") + body + zlib.crc32(body).to_bytes(4, "big")

    header = width.to_bytes(4, "big") + height.to_bytes(4, "big") + bytes([8, 2, 0, 0, 0])
    raw = b"".join(b"\x00" + b"\xff\x00\x00" * width for _ in range(height))
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )
