/**
 * Cloud service catalog: the concrete, CURRENT service each of the three supported platforms
 * offers for every logical component the architecture planner can select. This is the single
 * source of truth the planner and the AI prompt both read from, so a proposed architecture is
 * never limited to a generic, cloud-agnostic technology list (spec section 3 constraint).
 *
 * Every entry must have a non-empty, current service name for all three platforms - there is no
 * 'N/A' escape hatch, because the spec requires the recommendation to be platform-specific.
 */
import type { ArchitectureArea, CloudPlatform, CloudServiceCatalogEntry } from '../../domain';

type ServiceTuple = readonly [platform: CloudPlatform, service: string, notes: string];

/** Builds one catalog row from a compact [platform, service, notes] tuple per cloud. */
function catalogEntry(
  logicalComponent: string,
  label: string,
  area: ArchitectureArea,
  aws: ServiceTuple,
  azure: ServiceTuple,
  gcp: ServiceTuple,
): CloudServiceCatalogEntry {
  return {
    logicalComponent,
    label,
    area,
    services: [aws, azure, gcp].map(([platform, service, notes]) => ({ platform, service, notes })),
  };
}

export const CLOUD_SERVICE_CATALOG: readonly CloudServiceCatalogEntry[] = [
  catalogEntry(
    'web-hosting-cdn',
    'Web Hosting & CDN',
    'user-apps',
    ['aws', 'Amazon CloudFront with a private Amazon S3 origin (Origin Access Control)', 'Global edge caching and TLS termination in front of the static front end.'],
    ['azure', 'Azure Static Web Apps with Azure Front Door', 'Managed static hosting with an integrated global CDN and WAF-capable front door.'],
    ['gcp', 'Firebase Hosting (global CDN)', 'Managed static hosting fronted by a global edge cache network.'],
  ),
  catalogEntry(
    'mobile-backend',
    'Mobile Backend',
    'user-apps',
    ['aws', 'AWS Amplify', 'Managed mobile/web backend services: auth hooks, data sync and hosting pipelines for client apps.'],
    ['azure', 'Azure Mobile Apps (App Service)', 'App Service capability tailored to mobile client authentication, push and offline data sync.'],
    ['gcp', 'Firebase (Cloud Functions and Firestore for mobile)', 'Managed mobile backend primitives: realtime data sync, auth hooks and serverless callable functions.'],
  ),
  catalogEntry(
    'container-runtime',
    'Container Runtime',
    'backend',
    ['aws', 'Amazon ECS on AWS Fargate', 'Serverless container hosting for backend services without managing cluster nodes.'],
    ['azure', 'Azure Container Apps', 'Serverless container hosting with built-in autoscaling and revision-based deployments.'],
    ['gcp', 'Google Cloud Run', 'Fully managed, request-driven container hosting that scales to zero.'],
  ),
  catalogEntry(
    'serverless-functions',
    'Serverless Functions',
    'backend',
    ['aws', 'AWS Lambda', 'Event-driven compute for short-lived, independently scaled backend logic.'],
    ['azure', 'Azure Functions', 'Event-driven compute integrated with the rest of the Azure messaging and data services.'],
    ['gcp', 'Cloud Run functions', 'Event-driven compute built on the same runtime as Cloud Run, scaling per invocation.'],
  ),
  catalogEntry(
    'scheduler',
    'Scheduler',
    'backend',
    ['aws', 'Amazon EventBridge Scheduler', 'Managed cron-style triggers for recurring batch jobs and maintenance tasks.'],
    ['azure', 'Azure Logic Apps (Recurrence trigger)', 'Recurrence-triggered workflow runs used for scheduled batch and cleanup jobs.'],
    ['gcp', 'Cloud Scheduler', 'Fully managed cron job scheduler that invokes HTTP, Pub/Sub or Workflows targets.'],
  ),
  catalogEntry(
    'api-gateway',
    'API Gateway',
    'api',
    ['aws', 'Amazon API Gateway', 'Managed ingress for REST/HTTP APIs with throttling, request validation and auth integration.'],
    ['azure', 'Azure API Management', 'Managed API front door with policies, versioning and a developer portal.'],
    ['gcp', 'Apigee API Management', 'Managed API gateway with traffic management, quotas and analytics.'],
  ),
  catalogEntry(
    'managed-relational-db',
    'Managed Relational Database',
    'data-storage',
    ['aws', 'Amazon RDS for PostgreSQL', 'Managed PostgreSQL with automated backups, patching and Multi-AZ failover.'],
    ['azure', 'Azure Database for PostgreSQL - Flexible Server', 'Managed PostgreSQL with automated backups, high availability and encryption at rest.'],
    ['gcp', 'Cloud SQL for PostgreSQL', 'Managed PostgreSQL with automated backups, replication and encryption at rest.'],
  ),
  catalogEntry(
    'nosql-document-db',
    'NoSQL / Document Database',
    'data-storage',
    ['aws', 'Amazon DynamoDB', 'Serverless key-value/document store for high-throughput, low-latency access patterns.'],
    ['azure', 'Azure Cosmos DB (NoSQL API)', 'Globally distributed document database with single-digit-millisecond latency.'],
    ['gcp', 'Firestore', 'Serverless document database with realtime sync and offline client support.'],
  ),
  catalogEntry(
    'cache',
    'Cache',
    'data-storage',
    ['aws', 'Amazon ElastiCache for Redis', 'In-memory cache that reduces database load and read latency under peak traffic.'],
    ['azure', 'Azure Cache for Redis', 'Managed in-memory cache for session state and frequently read data.'],
    ['gcp', 'Memorystore for Redis', 'Managed in-memory cache for session state and frequently read data.'],
  ),
  catalogEntry(
    'object-storage',
    'Object Storage',
    'data-storage',
    ['aws', 'Amazon S3', 'Durable object storage for documents, exports and unstructured content.'],
    ['azure', 'Azure Blob Storage', 'Durable object storage for documents, exports and unstructured content.'],
    ['gcp', 'Google Cloud Storage', 'Durable object storage for documents, exports and unstructured content.'],
  ),
  catalogEntry(
    'search-service',
    'Search Service',
    'data-storage',
    ['aws', 'Amazon OpenSearch Service', 'Managed full-text and faceted search/indexing over application content.'],
    ['azure', 'Azure AI Search', 'Managed full-text, faceted and vector search/indexing over application content.'],
    ['gcp', 'Vertex AI Search', 'Managed search and retrieval over application and document content.'],
  ),
  catalogEntry(
    'data-warehouse',
    'Data Warehouse',
    'data-storage',
    ['aws', 'Amazon Redshift', 'Column-oriented analytical store for reporting and BI workloads.'],
    ['azure', 'Azure Synapse Analytics (dedicated SQL pool)', 'Column-oriented analytical store for reporting and BI workloads.'],
    ['gcp', 'BigQuery', 'Serverless, column-oriented analytical warehouse for reporting and BI workloads.'],
  ),
  catalogEntry(
    'etl-pipeline',
    'ETL / Data Pipeline',
    'data-storage',
    ['aws', 'AWS Glue', 'Managed batch/streaming ETL that moves and transforms data between systems.'],
    ['azure', 'Azure Data Factory', 'Managed batch/streaming ETL that moves and transforms data between systems.'],
    ['gcp', 'Dataflow', 'Managed batch/streaming ETL built on Apache Beam pipelines.'],
  ),
  catalogEntry(
    'bi-reporting',
    'BI / Reporting',
    'data-storage',
    ['aws', 'Amazon QuickSight', 'Self-service dashboards and reports over the warehouse for business stakeholders.'],
    ['azure', 'Power BI', 'Self-service dashboards and reports over the warehouse for business stakeholders.'],
    ['gcp', 'Looker', 'Governed self-service dashboards and reports over the warehouse.'],
  ),
  catalogEntry(
    'streaming',
    'Streaming Data',
    'messaging',
    ['aws', 'Amazon Kinesis Data Streams', 'Real-time ingestion and processing of high-volume event streams.'],
    ['azure', 'Azure Event Hubs', 'Real-time ingestion and processing of high-volume event streams.'],
    ['gcp', 'Pub/Sub (streaming ingestion)', 'Real-time ingestion and processing of high-volume event streams.'],
  ),
  catalogEntry(
    'message-queue',
    'Message Queue',
    'messaging',
    ['aws', 'Amazon SQS', 'Durable point-to-point queuing that decouples producers from consumers.'],
    ['azure', 'Azure Service Bus (queues)', 'Durable point-to-point queuing with dead-lettering and sessions.'],
    ['gcp', 'Pub/Sub (queue-style subscription)', 'Durable point-to-point queuing that decouples producers from consumers.'],
  ),
  catalogEntry(
    'event-bus',
    'Event Bus',
    'messaging',
    ['aws', 'Amazon EventBridge', 'Schema-aware event routing between decoupled services and SaaS sources.'],
    ['azure', 'Azure Event Grid', 'Schema-aware event routing between decoupled services and SaaS sources.'],
    ['gcp', 'Eventarc', 'Schema-aware event routing between decoupled services, backed by Pub/Sub.'],
  ),
  catalogEntry(
    'notification',
    'Notification (Email/SMS/Push)',
    'messaging',
    ['aws', 'Amazon SNS with Amazon SES', 'Fan-out push/SMS notifications paired with transactional email delivery.'],
    ['azure', 'Azure Communication Services', 'Unified email, SMS and push notification delivery.'],
    ['gcp', 'Firebase Cloud Messaging with Pub/Sub-triggered email/SMS delivery', 'Push notifications paired with event-triggered email/SMS delivery.'],
  ),
  catalogEntry(
    'workflow-orchestration',
    'Workflow Orchestration',
    'integration',
    ['aws', 'AWS Step Functions', 'Coordinates multi-step business processes and long-running orchestrations across services.'],
    ['azure', 'Azure Durable Functions', 'Coordinates multi-step business processes and long-running orchestrations across services.'],
    ['gcp', 'Workflows', 'Coordinates multi-step business processes and long-running orchestrations across services.'],
  ),
  catalogEntry(
    'integration-service',
    'Integration / iPaaS',
    'integration',
    ['aws', 'Amazon AppFlow', 'No-code, managed integration for exchanging data with SaaS and partner systems.'],
    ['azure', 'Azure Logic Apps', 'Managed iPaaS connectors and workflows for internal and partner system integration.'],
    ['gcp', 'Application Integration', 'Managed iPaaS connectors and workflows for internal and partner system integration.'],
  ),
  catalogEntry(
    'sftp-file-transfer',
    'SFTP / File Transfer',
    'integration',
    ['aws', 'AWS Transfer Family', 'Managed SFTP/FTPS endpoint backed by object storage for partner file exchange.'],
    ['azure', 'Azure Blob Storage (SFTP support)', 'Managed SFTP endpoint backed by Blob Storage for partner file exchange.'],
    ['gcp', 'Storage Transfer Service with a self-managed SFTP gateway on Compute Engine', 'Scheduled file transfer into Cloud Storage via a self-managed SFTP gateway pattern.'],
  ),
  catalogEntry(
    'identity-customer',
    'Customer Identity (CIAM)',
    'identity',
    ['aws', 'Amazon Cognito', 'Sign-up/sign-in, SSO and MFA for external end users.'],
    ['azure', 'Microsoft Entra External ID', 'Sign-up/sign-in, SSO and MFA for external end users.'],
    ['gcp', 'Identity Platform', 'Sign-up/sign-in, SSO and MFA for external end users.'],
  ),
  catalogEntry(
    'identity-workforce',
    'Workforce Identity',
    'identity',
    ['aws', 'AWS IAM Identity Center', 'SSO and access governance for internal staff and administrators.'],
    ['azure', 'Microsoft Entra ID', 'SSO and access governance for internal staff and administrators.'],
    ['gcp', 'Cloud Identity', 'SSO and access governance for internal staff and administrators.'],
  ),
  catalogEntry(
    'secrets-manager',
    'Secrets Manager',
    'security',
    ['aws', 'AWS Secrets Manager', 'Centralized storage, rotation and access control for credentials and API keys.'],
    ['azure', 'Azure Key Vault (secrets)', 'Centralized storage, rotation and access control for credentials and API keys.'],
    ['gcp', 'Secret Manager', 'Centralized storage, rotation and access control for credentials and API keys.'],
  ),
  catalogEntry(
    'key-management',
    'Key Management',
    'security',
    ['aws', 'AWS KMS', 'Managed encryption keys with rotation and audit logging for data at rest.'],
    ['azure', 'Azure Key Vault (keys, HSM-backed)', 'Managed encryption keys with rotation and audit logging for data at rest.'],
    ['gcp', 'Cloud KMS', 'Managed encryption keys with rotation and audit logging for data at rest.'],
  ),
  catalogEntry(
    'waf-ddos',
    'WAF / DDoS Protection',
    'security',
    ['aws', 'AWS WAF with AWS Shield', 'Edge filtering of malicious traffic and volumetric attack mitigation.'],
    ['azure', 'Azure Web Application Firewall with Azure DDoS Protection', 'Edge filtering of malicious traffic and volumetric attack mitigation.'],
    ['gcp', 'Google Cloud Armor', 'Edge filtering of malicious traffic and volumetric attack mitigation.'],
  ),
  catalogEntry(
    'private-networking',
    'Private Networking',
    'security',
    ['aws', 'Amazon VPC with AWS PrivateLink', 'Isolates workloads and keeps service-to-service traffic off the public internet.'],
    ['azure', 'Azure Virtual Network with Private Endpoints', 'Isolates workloads and keeps service-to-service traffic off the public internet.'],
    ['gcp', 'VPC Service Controls with Private Service Connect', 'Isolates workloads and keeps service-to-service traffic off the public internet.'],
  ),
  catalogEntry(
    'llm-platform',
    'LLM Platform',
    'ai-ml',
    ['aws', 'Amazon Bedrock', 'Managed access to foundation models with guardrails, evaluation and grounding.'],
    ['azure', 'Azure OpenAI in Azure AI Foundry', 'Managed access to foundation models with guardrails, evaluation and grounding.'],
    ['gcp', 'Vertex AI (Generative AI / Model Garden)', 'Managed access to foundation models with guardrails, evaluation and grounding.'],
  ),
  catalogEntry(
    'vector-search',
    'Vector Search',
    'ai-ml',
    ['aws', 'Amazon Bedrock Knowledge Bases with the OpenSearch Serverless vector engine', 'Similarity search over embeddings for retrieval-augmented generation.'],
    ['azure', 'Azure AI Search (vector search)', 'Similarity search over embeddings for retrieval-augmented generation.'],
    ['gcp', 'Vertex AI Vector Search', 'Similarity search over embeddings for retrieval-augmented generation.'],
  ),
  catalogEntry(
    'document-ai',
    'Document AI / OCR',
    'ai-ml',
    ['aws', 'Amazon Textract', 'Extracts structured text, tables and entities from scanned/unstructured documents.'],
    ['azure', 'Azure AI Document Intelligence', 'Extracts structured text, tables and entities from scanned/unstructured documents.'],
    ['gcp', 'Document AI', 'Extracts structured text, tables and entities from scanned/unstructured documents.'],
  ),
  catalogEntry(
    'ml-platform',
    'ML Platform',
    'ai-ml',
    ['aws', 'Amazon SageMaker', 'Trains, deploys and monitors predictive/classical machine-learning models.'],
    ['azure', 'Azure Machine Learning', 'Trains, deploys and monitors predictive/classical machine-learning models.'],
    ['gcp', 'Vertex AI (custom training and pipelines)', 'Trains, deploys and monitors predictive/classical machine-learning models.'],
  ),
  catalogEntry(
    'monitoring',
    'Monitoring',
    'observability',
    ['aws', 'Amazon CloudWatch', 'Metrics, dashboards and alerting for infrastructure and application health.'],
    ['azure', 'Azure Monitor', 'Metrics, dashboards and alerting for infrastructure and application health.'],
    ['gcp', 'Cloud Monitoring', 'Metrics, dashboards and alerting for infrastructure and application health.'],
  ),
  catalogEntry(
    'logging',
    'Logging',
    'observability',
    ['aws', 'Amazon CloudWatch Logs', 'Centralized, queryable log aggregation with configurable retention.'],
    ['azure', 'Azure Monitor Log Analytics', 'Centralized, queryable log aggregation with configurable retention.'],
    ['gcp', 'Cloud Logging', 'Centralized, queryable log aggregation with configurable retention.'],
  ),
  catalogEntry(
    'tracing',
    'Distributed Tracing',
    'observability',
    ['aws', 'AWS X-Ray', 'End-to-end request tracing across services for latency and failure diagnosis.'],
    ['azure', 'Azure Monitor Application Insights (distributed tracing)', 'End-to-end request tracing across services for latency and failure diagnosis.'],
    ['gcp', 'Cloud Trace', 'End-to-end request tracing across services for latency and failure diagnosis.'],
  ),
  catalogEntry(
    'ci-cd',
    'CI/CD',
    'deployment',
    ['aws', 'AWS CodePipeline with AWS CodeBuild', 'Automated build, test and release pipeline for every environment.'],
    ['azure', 'Azure Pipelines', 'Automated build, test and release pipeline for every environment.'],
    ['gcp', 'Cloud Build with Cloud Deploy', 'Automated build, test and release pipeline for every environment.'],
  ),
  catalogEntry(
    'container-registry',
    'Container Registry',
    'deployment',
    ['aws', 'Amazon Elastic Container Registry', 'Versioned, scanned storage for container images consumed by the runtime.'],
    ['azure', 'Azure Container Registry', 'Versioned, scanned storage for container images consumed by the runtime.'],
    ['gcp', 'Artifact Registry', 'Versioned, scanned storage for container images consumed by the runtime.'],
  ),
  catalogEntry(
    'infrastructure-as-code',
    'Infrastructure as Code',
    'environments',
    ['aws', 'AWS CloudFormation', 'Declarative provisioning that keeps dev/test/prod environments reproducible.'],
    ['azure', 'Azure Resource Manager (Bicep templates)', 'Declarative provisioning that keeps dev/test/prod environments reproducible.'],
    ['gcp', 'Google Cloud Infrastructure Manager', 'Declarative, Terraform-based provisioning that keeps dev/test/prod environments reproducible.'],
  ),
  catalogEntry(
    'backup',
    'Backup',
    'backup-dr',
    ['aws', 'AWS Backup', 'Centralized, policy-driven backup and recovery point management across services.'],
    ['azure', 'Azure Backup', 'Centralized, policy-driven backup and recovery point management across services.'],
    ['gcp', 'Google Cloud Backup and DR Service', 'Centralized, policy-driven backup and recovery point management across services.'],
  ),
  catalogEntry(
    'dr-multi-region',
    'Disaster Recovery / Multi-Region',
    'backup-dr',
    ['aws', 'Amazon RDS cross-Region read replica with AWS Backup cross-Region copy', 'Cross-region failover to meet recovery time and point objectives.'],
    ['azure', 'Azure Database for PostgreSQL cross-region read replica with geo-redundant backup (paired region)', 'Cross-region failover to meet recovery time and point objectives.'],
    ['gcp', 'Cloud SQL cross-region read replica with Google Cloud Backup and DR Service', 'Cross-region failover to meet recovery time and point objectives.'],
  ),
  catalogEntry(
    'availability-scaling',
    'High Availability & Autoscaling',
    'availability',
    ['aws', 'Application Load Balancer with Amazon ECS Service Auto Scaling across Availability Zones', 'Distributes traffic and scales capacity automatically to sustain uptime under load or failure.'],
    ['azure', 'Zone-redundant Azure Container Apps environment with KEDA scale rules', 'Distributes traffic and scales capacity automatically to sustain uptime under load or failure.'],
    ['gcp', 'Cloud Run regional autoscaling behind a global external Application Load Balancer', 'Distributes traffic and scales capacity automatically to sustain uptime under load or failure.'],
  ),
] as const;

const CATALOG_BY_LOGICAL_COMPONENT: ReadonlyMap<string, CloudServiceCatalogEntry> = new Map(
  CLOUD_SERVICE_CATALOG.map((entry) => [entry.logicalComponent, entry]),
);

/** The catalog row for a logical component, or undefined when it is not in the catalog. */
export function getCatalogEntry(logicalComponent: string): CloudServiceCatalogEntry | undefined {
  return CATALOG_BY_LOGICAL_COMPONENT.get(logicalComponent);
}

/** Concrete service name for a logical component on a platform, or undefined if not in the catalog. */
export function getCatalogService(logicalComponent: string, platform: CloudPlatform): string | undefined {
  return getCatalogEntry(logicalComponent)?.services.find((entry) => entry.platform === platform)?.service;
}

/** Every service name the catalog lists for a platform (used for cross-cloud conflict detection). */
export function servicesForPlatform(platform: CloudPlatform): Set<string> {
  const services = new Set<string>();
  for (const entry of CLOUD_SERVICE_CATALOG) {
    const service = entry.services.find((candidate) => candidate.platform === platform)?.service;
    if (service !== undefined) {
      services.add(service);
    }
  }
  return services;
}

/** Human-readable name of a supported cloud platform. */
export function platformLabel(platform: CloudPlatform): string {
  switch (platform) {
    case 'aws':
      return 'Amazon Web Services (AWS)';
    case 'azure':
      return 'Microsoft Azure';
    case 'gcp':
      return 'Google Cloud Platform (GCP)';
  }
}
