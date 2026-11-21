/**
 * Keyword table for the shared signal taxonomy (src/domain/signals.ts).
 *
 * Terms are lower-case, hyphen-free (the matcher normalises "real-time" to "real time") and are
 * matched at word starts, so 'encrypt' also covers 'encryption'. Terms of three characters or
 * fewer only match whole words. Every signal id of the taxonomy must have an entry here - a unit
 * test enforces it.
 */
export interface SignalKeywordEntry {
  signalId: string;
  terms: readonly string[];
}

export const SIGNAL_KEYWORDS: readonly SignalKeywordEntry[] = [
  // Capabilities
  { signalId: 'capability:identity', terms: ['register', 'registration', 'sign in', 'sign up', 'signup', 'log in', 'login', 'user profile', 'their profile', 'my profile', 'profile management', 'account creation', 'password reset', 'create an account'] },
  { signalId: 'capability:search', terms: ['search', 'filter', 'lookup', 'look up', 'browse', 'discover'] },
  { signalId: 'capability:documents', terms: ['document', 'upload', 'download', 'attachment', 'pdf', 'file storage', 'file sharing'] },
  { signalId: 'capability:payments', terms: ['payment', 'pay online', 'billing system', 'invoice', 'checkout', 'subscription', 'refund', 'credit card', 'direct debit'] },
  { signalId: 'capability:notifications', terms: ['notification', 'notify', 'alert', 'reminder', 'push message', 'email updates'] },
  { signalId: 'capability:reporting', terms: ['dashboard', 'report', 'analytics', 'kpi', 'insight', 'visualis', 'visualiz', 'scorecard'] },
  { signalId: 'capability:workflow', terms: ['workflow', 'approval', 'approve', 'escalat', 'routing', 'case management', 'task assignment', 'review queue', 'business process'] },
  { signalId: 'capability:admin', terms: ['admin', 'configuration', 'configurable', 'back office', 'manage users', 'user management', 'settings'] },
  { signalId: 'capability:mobile', terms: ['mobile', 'ios', 'android', 'smartphone', 'tablet', 'native app', 'field app'] },
  { signalId: 'capability:portal', terms: ['self service portal', 'self service', 'self serve', 'customer portal', 'client portal', 'member portal', 'partner portal', 'customer facing', 'web application', 'web app', 'website'] },
  { signalId: 'capability:catalog', terms: ['catalog', 'catalogue', 'inventory', 'product listing', 'sku', 'stock level', 'price list'] },
  { signalId: 'capability:scheduling', terms: ['book an appointment', 'schedule an appointment', 'appointment booking', 'appointment scheduling', 'appointment reminder', 'reschedul', 'booking', 'calendar', 'reservation', 'staff roster', 'shift roster'] },
  { signalId: 'capability:messaging', terms: ['messaging', 'live chat', 'chat with', 'secure message', 'comment', 'collaborat', 'discussion', 'inbox'] },
  { signalId: 'capability:orders', terms: ['orders', 'order management', 'order status', 'order tracking', 'place an order', 'place order', 'purchase order', 'work order', 'fulfilment', 'fulfillment', 'shipment', 'shipping', 'shopping cart'] },
  { signalId: 'capability:content', terms: ['content management', 'cms', 'knowledge base', 'articles', 'publish content', 'publish an article', 'news', 'blog', 'landing page'] },
  { signalId: 'capability:forms', terms: ['forms', 'web form', 'online form', 'form builder', 'submit', 'survey', 'questionnaire', 'data capture', 'intake'] },
  // Integrations
  { signalId: 'integration:crm', terms: ['crm', 'salesforce', 'dynamics 365', 'hubspot', 'zoho', 'customer relationship management'] },
  { signalId: 'integration:erp', terms: ['erp', 'sap', 'netsuite', 'oracle ebs', 'oracle e business', 'dynamics ax', 'dynamics nav', 'jd edwards', 'general ledger', 'finance system'] },
  { signalId: 'integration:payment-gateway', terms: ['payment gateway', 'stripe', 'paypal', 'adyen', 'braintree', 'worldpay', 'payment provider', 'payment processor', 'card payment'] },
  { signalId: 'integration:identity-provider', terms: ['identity provider', 'active directory', 'azure ad', 'entra', 'okta', 'auth0', 'ping identity', 'ldap', 'saml', 'oidc', 'openid', 'idp', 'adfs', 'cognito'] },
  { signalId: 'integration:email-sms', terms: ['sms', 'email gateway', 'sendgrid', 'twilio', 'mailchimp', 'email notification', 'text message', 'smtp', 'whatsapp'] },
  { signalId: 'integration:legacy', terms: ['legacy', 'mainframe', 'as/400', 'as400', 'cobol', 'green screen', 'homegrown', 'home grown', 'in house system', 'bespoke system', 'db2', 'access database', 'vb6', 'end of life'] },
  { signalId: 'integration:ehr', terms: ['ehr', 'emr', 'hl7', 'fhir', 'epic ehr', 'epic emr', 'epic systems', 'cerner', 'clinical system', 'patient record', 'electronic health'] },
  { signalId: 'integration:data-warehouse', terms: ['data warehouse', 'snowflake', 'redshift', 'bigquery', 'synapse', 'power bi', 'tableau', 'looker', 'bi platform', 'bi tool', 'databricks', 'qlik'] },
  { signalId: 'integration:hr', terms: ['workday', 'successfactors', 'bamboohr', 'hr system', 'hr platform', 'hris', 'payroll', 'adp', 'human resources', 'peoplesoft'] },
  { signalId: 'integration:itsm', terms: ['servicenow', 'jira', 'itsm', 'zendesk', 'service desk', 'ticketing', 'helpdesk', 'help desk', 'freshdesk', 'remedy'] },
  { signalId: 'integration:esign', terms: ['docusign', 'e signature', 'esignature', 'electronic signature', 'adobe sign', 'digital signature', 'e sign'] },
  { signalId: 'integration:maps', terms: ['google maps', 'geolocation', 'gps', 'mapping service', 'geocod', 'map view', 'location tracking', 'route optim', 'gis', 'geospatial'] },
  { signalId: 'integration:realtime', terms: ['real time', 'realtime', 'event driven', 'webhook', 'streaming', 'pub/sub', 'message queue', 'kafka', 'push update', 'live update', 'instantly'] },
  { signalId: 'integration:batch', terms: ['batch', 'nightly', 'overnight', 'scheduled job', 'daily extract', 'daily load', 'end of day'] },
  { signalId: 'integration:file', terms: ['sftp', 'ftp', 'csv', 'flat file', 'file transfer', 'file drop', 'excel', 'spreadsheet', 'xml file', 'file based', 'edi'] },
  { signalId: 'integration:api', terms: ['api', 'rest api', 'restful', 'rest service', 'graphql', 'soap', 'web service', 'endpoint', 'odata', 'microservice'] },
  // Data
  { signalId: 'data:migration', terms: ['migrat', 'data conversion', 'historical data', 'legacy data', 'cutover', 'data load', 'import existing', 'years of data', 'years of history', 'backfill'] },
  { signalId: 'data:warehouse', terms: ['data warehouse', 'data lake', 'lakehouse', 'data mart', 'analytical store', 'snowflake', 'bigquery', 'redshift', 'synapse', 'single source of truth', 'data platform'] },
  { signalId: 'data:etl', terms: ['etl', 'elt', 'data pipeline', 'pipeline', 'ingest', 'data integration', 'data factory', 'consolidat', 'transformation rules'] },
  { signalId: 'data:streaming', terms: ['streaming', 'stream processing', 'kafka', 'event hub', 'kinesis', 'event stream', 'real time data', 'real time feed', 'pub/sub'] },
  { signalId: 'data:pii', terms: ['personal data', 'pii', 'personally identifiable', 'sensitive data', 'patient data', 'health information', 'phi', 'customer data', 'cardholder', 'date of birth', 'social security', 'member data', 'personal information', 'confidential'] },
  { signalId: 'data:documents', terms: ['document', 'pdf', 'scanned', 'unstructured', 'image', 'attachment', 'contracts', 'knowledge base', 'file storage'] },
  { signalId: 'data:retention', terms: ['retention', 'retain', 'archiv', 'purge', 'data deletion', 'right to be forgotten', 'right to erasure', 'records management', 'seven years', '7 years'] },
  { signalId: 'data:master-data', terms: ['master data', 'reference data', 'mdm', 'golden record', 'product master', 'customer master', 'single customer view', 'data dictionary'] },
  { signalId: 'data:reporting', terms: ['report', 'dashboard', 'analytics', 'kpi', 'business intelligence', 'power bi', 'tableau', 'data mart', 'metrics'] },
  { signalId: 'data:telemetry', terms: ['iot', 'sensor', 'telemetry', 'device data', 'telematics', 'scada', 'connected device', 'machine data', 'meter reading', 'smart meter'] },
  { signalId: 'data:quality', terms: ['data quality', 'reconcil', 'deduplic', 'duplicate', 'cleans', 'data validation', 'inconsistent data', 'data governance', 'data lineage'] },
  // AI
  { signalId: 'ai:assistant', terms: ['assistant', 'chatbot', 'chat bot', 'virtual agent', 'conversational', 'copilot', 'co pilot', 'ai agent'] },
  { signalId: 'ai:rag', terms: ['knowledge base', 'answers questions', 'answer questions', 'question answering', 'retrieval', 'rag', 'document library', 'semantic search', 'ask questions', 'natural language search', 'from our documents'] },
  { signalId: 'ai:classification', terms: ['classifier', 'auto classif', 'automatically classif', 'classification model', 'document classification', 'email classification', 'ticket classification', 'categoris', 'categoriz', 'triage', 'auto route', 'automatically route', 'intent detection', 'sentiment', 'auto tag'] },
  { signalId: 'ai:extraction', terms: ['ocr', 'extraction', 'extract data', 'extract information', 'extract key', 'extract fields', 'intelligent document', 'invoice processing', 'form recognition'] },
  { signalId: 'ai:recommendation', terms: ['recommendation', 'recommender', 'recommends', 'recommend products', 'recommend content', 'personalis', 'personaliz', 'next best action', 'cross sell', 'upsell', 'suggested products', 'based on similar', 'similar historical', 'suggested range', 'advisory only'] },
  { signalId: 'ai:forecasting', terms: ['forecast', 'predict', 'demand planning', 'propensity', 'churn', 'time series', 'machine learning'] },
  { signalId: 'ai:summarization', terms: ['summaris', 'summariz', 'auto summar', 'digest', 'key points', 'meeting notes', 'condense'] },
  { signalId: 'ai:anomaly', terms: ['anomal', 'fraud', 'outlier', 'suspicious', 'unusual activity', 'unusual pattern', 'threat detection', 'predictive maintenance'] },
  { signalId: 'ai:generation', terms: ['generative', 'generate content', 'content generation', 'genai', 'gen ai', 'llm', 'large language model', 'gpt', 'auto generate', 'generate responses', 'generate draft', 'draft replies', 'ai powered', 'ai driven'] },
  { signalId: 'ai:vision', terms: ['computer vision', 'image recognition', 'object detection', 'image analysis', 'photo analysis', 'video analytics', 'facial recognition', 'visual inspection', 'damage detection', 'image classification'] },
  { signalId: 'ai:speech', terms: ['speech', 'voice', 'transcri', 'text to speech', 'ivr', 'call recording', 'dictation'] },
  // Non-functional
  { signalId: 'nfr:availability', terms: ['availability', 'uptime', '99.5', '99.9', '99.95', '99.99', 'highly available', 'disaster recovery', 'failover', 'rto', 'rpo', '24/7', '24x7', 'business continuity', 'redundan', 'downtime', 'resilien'] },
  { signalId: 'nfr:performance', terms: ['performance', 'response time', 'latency', 'page load', 'seconds', 'millisecond', 'throughput', 'fast', 'sub second', 'load time', 'quickly'] },
  { signalId: 'nfr:scalability', terms: ['scalab', 'scale', 'concurrent', 'peak', 'elastic', 'auto scal', 'high volume', 'thousands of', 'millions of', 'registered members', 'registered users', 'support up to', 'growth in users'] },
  { signalId: 'nfr:accessibility', terms: ['accessib', 'wcag', 'screen reader', 'section 508', 'ada complian', 'assistive', 'a11y'] },
  { signalId: 'nfr:localization', terms: ['localis', 'localiz', 'multilingual', 'multi lingual', 'multiple languages', 'translation', 'language support', 'i18n', 'multi currency', 'bilingual', 'time zone'] },
  { signalId: 'nfr:observability', terms: ['monitoring', 'observab', 'logging', 'alerting', 'tracing', 'health check', 'application insights', 'sla reporting'] },
  { signalId: 'nfr:usability', terms: ['usab', 'user friendly', 'intuitive', 'easy to use', 'user experience', 'modern ui', 'modern look', 'ux', 'simple to use', 'minimal training', 'ease of use'] },
  { signalId: 'nfr:maintainability', terms: ['maintainab', 'modular', 'extensib', 'ci/cd', 'automated test', 'code quality', 'devops', 'technical debt', 'low code', 'supportab', 'knowledge transfer'] },
  { signalId: 'nfr:offline', terms: ['offline', 'no connectivity', 'poor connectivity', 'low connectivity', 'without internet', 'disconnected', 'low bandwidth', 'intermittent'] },
  // Security
  { signalId: 'security:sso', terms: ['sso', 'single sign on', 'saml', 'oidc', 'openid', 'federat', 'azure ad', 'active directory', 'okta', 'entra'] },
  { signalId: 'security:mfa', terms: ['mfa', '2fa', 'multi factor', 'two factor', 'one time password', 'otp', 'authenticator app'] },
  { signalId: 'security:rbac', terms: ['rbac', 'role based', 'roles and permissions', 'permission', 'access control', 'least privilege', 'authoris', 'authoriz', 'user roles', 'segregation of duties'] },
  { signalId: 'security:encryption', terms: ['encrypt', 'tls', 'at rest', 'in transit', 'key management', 'kms', 'aes', 'https', 'cryptograph', 'tokenis', 'tokeniz'] },
  { signalId: 'security:audit', terms: ['audit', 'activity log', 'tamper', 'who did what', 'access log', 'immutable log', 'non repudiation'] },
  { signalId: 'security:secrets', terms: ['secrets', 'key vault', 'credential', 'password polic', 'certificate', 'key rotation', 'vault'] },
  { signalId: 'security:network', terms: ['firewall', 'waf', 'vpn', 'private network', 'ddos', 'network segment', 'ip whitelist', 'ip allow', 'private link', 'private endpoint', 'zero trust', 'penetration test', 'pen test', 'vulnerability', 'owasp', 'intrusion'] },
  { signalId: 'security:data-residency', terms: ['residency', 'data sovereignty', 'sovereign', 'within the eu', 'in country', 'data must remain', 'data must stay', 'onshore', 'data localisation', 'data localization'] },
  // Compliance
  { signalId: 'compliance:gdpr', terms: ['gdpr', 'general data protection', 'data protection act', 'ccpa', 'right to be forgotten', 'data subject'] },
  { signalId: 'compliance:hipaa', terms: ['hipaa', 'hitech', 'protected health information', 'phi'] },
  { signalId: 'compliance:pci', terms: ['pci', 'cardholder', 'card data', 'payment card industry'] },
  { signalId: 'compliance:soc2', terms: ['soc 2', 'soc2', 'soc ii', 'ssae'] },
  { signalId: 'compliance:iso27001', terms: ['iso 27001', 'iso27001', 'iso/iec 27001', '27001', 'isms'] },
  { signalId: 'compliance:sox', terms: ['sox', 'sarbanes', 'financial controls'] },
  { signalId: 'compliance:fedramp', terms: ['fedramp', 'fed ramp', 'fisma', 'nist 800', 'govcloud'] },
  // Cloud
  { signalId: 'cloud:aws', terms: ['aws', 'amazon web services', 'amazon s3', 'ec2', 'dynamodb', 'bedrock', 'sagemaker'] },
  { signalId: 'cloud:azure', terms: ['azure', 'microsoft cloud', 'microsoft 365', 'office 365', 'entra', 'power platform'] },
  { signalId: 'cloud:gcp', terms: ['gcp', 'google cloud', 'bigquery', 'vertex ai', 'cloud run', 'firebase', 'gke'] },
  { signalId: 'cloud:hybrid', terms: ['hybrid', 'on premise', 'on prem', 'onprem', 'own data cent', 'private cloud', 'data center', 'data centre', 'multi cloud', 'self hosted'] },
  // Delivery
  { signalId: 'delivery:deadline', terms: ['deadline', 'go live', 'golive', 'launch', 'no later than', 'target date', 'timeline', 'time to market', 'due date', 'by end of', 'by the end of', 'must be delivered', 'delivery date', 'in production by', 'live by', 'live before'] },
  { signalId: 'delivery:budget', terms: ['budget', 'funding', 'cost ceiling', 'cost cap', 'fixed price', 'not to exceed', 'capex', 'opex', 'cost constraint'] },
  { signalId: 'delivery:phased', terms: ['phase', 'mvp', 'pilot', 'increment', 'rollout', 'roll out', 'first release', 'proof of concept', 'poc', 'iterative'] },
  { signalId: 'delivery:team', terms: ['our team', 'our developers', 'internal team', 'in house team', 'our it', 'product owner', 'co develop', 'work alongside', 'joint team', 'our engineers', 'subject matter expert', 'steering'] },
];
