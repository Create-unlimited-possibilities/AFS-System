# Project Proposal

```
Hong Kong Institute of Vocational Education (Tsing Yi)
Discipline of Information Technology
IT114116 – HD in Data Science and Analytics

Final Year Project – Big Data Analytics (ITP4870M)
Project Proposal (AY2025/26)

Project Title: Artificial Fluctlight Simulation System (AFSS)
               传家宝 - AI-Powered Virtual Replicas for Digital Legacy
```

---

## 1. Project Title

**English**: Artificial Fluctlight Simulation System (AFSS)
**Chinese**: 传家宝
**Short Name**: AFSS / 传家宝

---

## 2. Introduction to the Proposed Project

### 2.1 Statement of Problem

Terminally ill elderly and their descendants often face emotional disconnection. When elderly family members pass away, their children and grandchildren lose not just a loved one, but also:
- A source of wisdom and guidance
- Emotional support and companionship
- Family history and cultural heritage
- The opportunity to continue meaningful conversations

Existing digital legacy solutions (e.g., simple chatbots, audio/video recordings) lack:
- Deep personality simulation
- Dynamic memory updates
- Authentic emotional responses
- The ability to understand user personality at a fundamental level

### 2.2 Proposed Solution

We propose the **Artificial Fluctlight Simulation System (AFSS)** - a three-phase project to create AI-powered virtual replicas of elderly individuals that can continue providing emotional companionship to their families after they pass.

The system creates "digital souls" through:
1. **Fate Replicator** - Inferring complete life trajectories from birth data using Zi Wei Dou Shu (紫微斗数)
2. **Memory Arbor** - Fusing real memories with conversational memories using forgetting curve algorithms
3. **Fluctlight Core** - Simulating personality through a lightweight Five Aggregates (五蕴) framework

---

## 3. Background

### 3.1 Market Context

- Global digital legacy market projected to reach $120 billion by 2025
- Growing demand in Asian cultures that value filial piety (孝道)
- Increasing acceptance of AI-powered emotional support services
- Funeral industry undergoing digital transformation

### 3.2 Technical Foundation

- Large Language Models (LLMs) can now maintain consistent personalities
- Fine-tuning techniques (LoRA) enable efficient personality customization
- Vector databases allow efficient memory retrieval
- Multi-agent frameworks (LangGraph) enable complex conversation flows

### 3.3 Innovation

Unlike existing solutions, AFSS:
- Uses Zi Wei Dou Shu for deep personality understanding (not just surface traits)
- Implements continuous memory updates from family conversations
- Simulates emotional variation based on Buddhist Five Aggregates framework
- Generates virtual memories to fill information gaps authentically

---

## 4. Outline of Proposed Solution

### 4.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AFSS Three-Module Architecture                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│   │  Fate Replicator │    │  Memory Arbor   │    │ Fluctlight Core │ │
│   │    (Phase I)     │───▶│    (Phase II)   │───▶│   (Phase III)   │ │
│   └─────────────────┘    └─────────────────┘    └─────────────────┘ │
│           │                      │                      │            │
│           ▼                      ▼                      ▼            │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                    Conversation Layer                         │   │
│   │              (LangGraph Multi-Agent System)                   │   │
│   │   Intent → Memory → RAG → Fortune → Role → Output            │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                      Infrastructure                           │   │
│   │   Next.js + Express.js + MongoDB + ChromaDB + Ollama         │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Module Descriptions

**Phase I: Fate Replicator (命运复制器)**
- Input: Birth date/time + questionnaire responses
- Output: Complete life destiny trajectory and personality profile
- Technology: Zi Wei Dou Shu expert model (py-iztro + LoRA fine-tuning)
- Deliverable: Professional-grade destiny analysis reports

**Phase II: Memory Arbor (记忆之树)**
- Input: Real memories (diaries, interviews) + conversational memories
- Output: Fused memory store with realistic forgetting
- Technology: Ebbinghaus forgetting curve + FAISS vector retrieval
- Deliverable: Memory fusion system with <2s retrieval

**Phase III: Fluctlight Core (摇光核心)**
- Input: Fate profile + Memory store + Current context
- Output: Authentic personality responses with emotional variation
- Technology: Five Aggregates framework + LangGraph orchestration
- Deliverable: Complete virtual replica system

### 4.3 Questionnaire System

| Role | Layer | Description |
|------|-------|-------------|
| Elder (老人) | Basic (基础层) | Core life events and experiences |
| Elder (老人) | Emotional (情感层) | Values, wisdom, emotional patterns |
| Family (家人) | Basic | Family perspective on elder's life |
| Friend (朋友) | Basic | Friend perspective on elder's character |

### 4.4 Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 15 + TypeScript | User interface |
| Backend | Express.js + Node.js 20 | API server |
| AI/ML | DeepSeek R1-14B + Ollama | LLM inference |
| AI/ML | bge-m3 + ChromaDB | Embeddings & Vector DB |
| AI/ML | LangGraph + LangChain | Multi-agent orchestration |
| Training | Unsloth + LoRA | Fine-tuning |
| Database | MongoDB 7 | Document storage |
| Deployment | Docker + Docker Compose | Containerization |

---

## 5. Data Handled

### 5.1 Data Sources

| Source | Type | Volume |
|--------|------|--------|
| Zi Wei Classical Texts | Structured | ~1.2M Chinese characters |
| SFT Training Samples | ChatML | 2,427 samples |
| User Questionnaire | Structured JSON | ~500 responses/user |
| Conversational Memories | Unstructured text | Growing |
| Vector Embeddings | 1024-dim vectors | Per-user |

### 5.2 Data Flow

```
Birth Data → Zi Wei Chart → Personality Profile
     ↓
Questionnaire → Memory Extraction → Vector Store
     ↓
Conversation → Memory Update → Forgetting Curve
     ↓
User Query → RAG Retrieval → LLM Response
```

---

## 6. Main Development Phases

| Phase | Duration | Tasks | Deliverables |
|-------|----------|-------|--------------|
| **Phase 1: Fate Replicator** | Oct - Dec 2025 | Zi Wei training, chart calculation, script generation | Fate Replicator v1.0, test reports |
| **Phase 2: Memory Arbor** | Dec 2025 - Feb 2026 | Memory fusion, forgetting curve, RAG optimization | Memory Arbor prototype, benchmarks |
| **Phase 3: Fluctlight Core** | Feb - Apr 2026 | Five Aggregates, emotional variation, end-to-end testing | Integrated prototype, demo |
| **Phase 4: Multi-Entity Testing** | Apr - May 2026 | Deploy 3-5 replicas, family testing, optimization | Multi-entity environment, evaluation |
| **Phase 5: Final Release** | May 2026 | Documentation, knowledge transfer, deployment | Final report, GitHub repo |

---

## 7. Main Deliverables

1. **Executable Software**
   - Fate Replicator (Python training scripts)
   - Memory Arbor (Memory fusion module)
   - Fluctlight Core (Conversation engine)

2. **Source Code**
   - Public GitHub repository
   - Detailed API documentation (Sphinx-generated)
   - Docker deployment configuration

3. **Virtual Replica Demo**
   - 1-3 complete fluctlight entities
   - Demonstrating emotional interaction and memory updates

4. **Reports**
   - Phase progress reports
   - Final closure report with future roadmap

---

## 8. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Response Time | < 30 seconds per message |
| Memory Retrieval | < 2 seconds |
| Concurrent Users | 100+ |
| System Uptime | 99% |
| Data Privacy | All data encrypted at rest and in transit |
| Ethics | Consent from elderly and families, usage protocols |

---

## 9. Team Responsibilities

| Member | Role | Responsibilities |
|--------|------|-----------------|
| Cheung Wang Kwong (Leader) | Full-stack + AI | Architecture, model training, deployment |
| Cheng Kong Sang | Backend | API development, database design |
| He Xu | Frontend | UI/UX design, Next.js development |
| Au Chun Kit | Testing | QA, documentation, presentation |

---

## 10. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| LLM Training Failure | High | Low | Multiple backups, validation checkpoints |
| Memory Quality Issues | Medium | Medium | Manual curation, family verification |
| Performance Issues | Medium | Medium | Caching, optimization, scaling |
| Ethical Concerns | High | Low | Clear consent protocols, disclaimers |

---

## 11. Conclusion

The Artificial Fluctlight Simulation System (AFSS) addresses a genuine human need for digital legacy and emotional companionship. By combining traditional Chinese wisdom (Zi Wei Dou Shu) with modern AI technology, we aim to create virtual replicas that authentically preserve the personality, memories, and wisdom of elderly individuals.

Phase I (Fate Replicator) is already 85% complete, with the Zi Wei Dou Shu expert model achieving 96%+ accuracy. The project is on track to deliver a complete system by May 2026.

---

*Proposal submitted: [Date]*
*Supervisor: Benson Lau*
