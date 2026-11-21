/**
 * Public API of the cloud solution architecture module (spec section 3 / Architecture Workspace):
 *  - catalog: the AWS/Azure/GCP service catalog and its lookups.
 *  - recommender: transparent, additive platform recommendation.
 *  - componentRules + planner: the deterministic rule-based architecture planner (mock AI).
 *  - validate: semantic validation/correction of a generated architecture.
 *  - prompt: the 'design-architecture' AI task definition (live-provider prompt + schema).
 *  - diagramModel: renderer-neutral diagram model for the architecture diagram.
 *  - stage: generateArchitecture(), the stage entry other modules and the UI call.
 */
export * from './catalog/cloudServiceCatalog.data';
export * from './componentRules.data';
export * from './diagramModel';
export * from './environments';
export * from './externalRef';
export * from './flows';
export * from './justification';
export * from './planner';
export * from './prompt';
export * from './recommender';
export * from './scopeQueries';
export * from './stage';
export * from './validate';
