// server/src/modules/rolecard/v2/index.js

// Generators
export { default as CoreLayerGenerator } from './coreLayerGenerator.js';
export { default as RelationLayerGenerator } from './relationLayerGenerator.js';
export { default as DynamicDataFetcher } from './dynamicDataFetcher.js';
export { default as PromptAssembler } from './promptAssembler.js';

// Validation
export { validateASetCompletion } from './coreLayerGenerator.js';

// Safety & Calibration
export { SafetyGuardrailsManager, DEFAULT_GUARDRAIL_RULES, TRUST_LEVEL_DEFINITIONS } from './safetyGuardrails.js';
export { CalibrationLayerManager, DEFAULT_CALIBRATION_CONFIG } from './calibrationLayer.js';

// V2 Prompts - Core Layer
export {
  CORE_LAYER_FIELDS,
  PER_ANSWER_EXTRACTION_PROMPT,
  FIELD_COMPRESSION_PROMPT,
  buildPerAnswerExtractionPrompt,
  buildFieldCompressionPrompt
} from './prompts/coreExtractionV2.js';

// V2 Prompts - Relation Layer
export {
  COMMON_RELATION_FIELDS,
  FAMILY_SPECIFIC_FIELDS,
  FRIEND_SPECIFIC_FIELDS,
  FAMILY_RELATION_FIELDS,
  FRIEND_RELATION_FIELDS,
  PER_ANSWER_RELATION_EXTRACTION_PROMPT,
  RELATION_FIELD_COMPRESSION_PROMPT,
  TRUST_LEVEL_ANALYSIS_PROMPT,
  getFieldsForRelationType,
  buildPerAnswerRelationExtractionPrompt,
  buildRelationFieldCompressionPrompt,
  buildTrustLevelAnalysisPrompt
} from './prompts/relationExtractionV2.js';
