---
sidebar_position: 1
---

# RoleCard System Overview

## Architecture Level

The RoleCard System is a multi-layered profile management system that enables personalized AI interactions by maintaining detailed user profiles across multiple dimensions.

```mermaid
graph TB
    subgraph "RoleCard V2 Architecture"
        A[User Input] --> B[A-Set Questions<br/>Self-Perception]
        A --> C[B-Set Questions<br/>Family Perspective]
        A --> D[C-Set Questions<br/>Friend Perspective]

        B --> E[Core Layer<br/>Generator]
        C --> F[Relation Layer<br/>Generator]
        D --> F

        E --> G[Core Layer JSON<br/>core-layer.json]
        F --> H[Relation Layer Files<br/>relation-*.json]

        G --> I[Prompt Assembler]
        H --> I

        J[Safety Rules<br/>safety-rules.json] --> K[Safety Guardrails]
        L[Calibration Data] --> M[Calibration Layer]

        I --> N[System Prompt]
        K --> N
        M --> N

        N --> O[LLM Response]
    end

    style G fill:#e1f5ff
    style H fill:#fff4e1
    style N fill:#e8f5e9
```

## System Components

The RoleCard System consists of five main layers:

| Component | Description | File Location |
|-----------|-------------|---------------|
| **Core Layer** | User's intrinsic personality, values, and self-perception | `server/src/modules/rolecard/v2/coreLayerGenerator.js` |
| **Relation Layer** | Relationship-specific information from family and friends | `server/src/modules/rolecard/v2/relationLayerGenerator.js` |
| **Safety Guardrails** | Privacy protection rules for group conversations | `server/src/modules/rolecard/v2/safetyGuardrails.js` |
| **Calibration Layer** | Drift detection and update triggers | `server/src/modules/rolecard/v2/calibrationLayer.js` |
| **Prompt Assembler** | Converts layers into natural language system prompts | `server/src/modules/rolecard/v2/promptAssembler.js` |

## Data Flow

```mermaid
sequenceDiagram
    participant User
    participant QA as Questionnaire
    participant CoreGen as Core Generator
    participant RelGen as Relation Generator
    participant Storage as Dual Storage
    participant Assembler as Prompt Assembler
    participant LLM

    User->>QA: Answer A-Set (self)
    User->>QA: Answer B-Set (family)
    User->>QA: Answer C-Set (friends)

    Note over CoreGen: Generation Phase
    QA->>CoreGen: Self answers
    CoreGen->>CoreGen: Extract per answer
    CoreGen->>CoreGen: Compress fields
    CoreGen->>Storage: Save core-layer.json

    Note over RelGen: Generation Phase
    QA->>RelGen: Family/Friend answers
    RelGen->>RelGen: Extract per answer
    RelGen->>RelGen: Compress fields
    RelGen->>Storage: Save relation-*.json

    Note over Assembler: Runtime Phase
    Storage->>Assembler: Load layers
    Assembler->>Assembler: Build system prompt
    Assembler->>LLM: Send prompt
    LLM->>User: AI response
```

## File Structure

```
server/src/modules/rolecard/
├── config.js                    # Configuration parameters
├── controller.js                # API endpoints
├── route.js                     # Route definitions
└── v2/
    ├── index.js                 # Module exports
    ├── coreLayerGenerator.js    # Core layer generation
    ├── relationLayerGenerator.js # Relation layer generation
    ├── safetyGuardrails.js      # Safety rules management
    ├── calibrationLayer.js      # Drift detection
    ├── dynamicDataFetcher.js    # Runtime data loading
    ├── promptAssembler.js       # Prompt construction
    └── prompts/
        ├── coreExtractionV2.js  # Core layer prompts
        └── relationExtractionV2.js # Relation layer prompts
```

## Storage Structure

```
server/storage/
├── safety-rules.json           # Global safety rules
└── userdata/
    └── {userId}/
        ├── core-layer.json         # Core personality data
        ├── profile.json            # User profile
        └── relation-layers/        # Relationship data
            ├── {relationId-1}.json # Family/friend #1
            ├── {relationId-2}.json # Family/friend #2
            └── {relationId-N}.json # Family/friend #N
```

## Key Features

### 1. Layered Architecture
- **Core Layer**: Always loaded, contains intrinsic personality
- **Relation Layer**: Loaded on-demand based on conversation participants
- **Safety Guardrails**: Activated for group conversations only

### 2. Progressive Generation
- Each layer can be generated independently
- SSE (Server-Sent Events) for real-time progress updates
- Graceful handling of missing data

### 3. Intelligent Compression
- Two-stage extraction: per-answer extraction → field compression
- Token budget control for each field
- Natural language output with key points extraction

### 4. Privacy Protection
- Trust level assessment via LLM analysis
- Dynamic rule filtering based on group composition
- Tiered disclosure levels

## Theoretical Foundation

### CPM Theory (Communication Privacy Management)
The system implements Petronio's CPM theory through:
- **Boundary Thickness**: Controlled via trust levels
- **Boundary Ownership**: Managed through relation-specific layers
- **Boundary Coordination**: Handled by safety guardrails in groups

### Self-Presentation Theory
The system supports Goffman's self-presentation theory through:
- **Front Stage Behavior**: Relation-specific communication styles
- **Impression Management**: Perceived traits from others' perspectives
- **Role Switching**: Dynamic loading based on conversation context

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/rolecard/generate` | Generate complete role card |
| POST | `/api/rolecard/generate/stream` | Generate with SSE progress |
| GET | `/api/rolecard` | Get user's role card |
| PUT | `/api/rolecard` | Update role card |
| DELETE | `/api/rolecard` | Delete role card |
| GET | `/api/rolecard/layers/status` | Check generation status |
| POST | `/api/rolecard/core/stream` | Generate core layer only |
| POST | `/api/rolecard/relation/:id/stream` | Generate single relation layer |
| POST | `/api/rolecard/batch/stream` | Batch generate layers |
