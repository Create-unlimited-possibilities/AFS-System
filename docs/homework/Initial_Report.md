# Cover Page

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                     Hong Kong Institute of Vocational Education             │
│                                   (Tsing Yi)                                │
│                                                                             │
│                       Discipline of Information Technology                  │
│                                                                             │
│             HD in Data Science and Analytics (IT114116)                     │
│                                                                             │
│                                                                             │
│                   Final Year Project – Initial Report                       │
│                                                                             │
│                          (ITP4870M) AY2025/26                              │
│                                                                             │
│                                                                             │
│                                                                             │
│                  Artificial Fluctlight Simulation System                    │
│                              传家宝 (AFSS)                                  │
│                                                                             │
│         An AI-Powered Virtual Replica Platform for Digital Legacy           │
│                    and Emotional Companionship Application                  │
│                                                                             │
│                                                                             │
│                                                                             │
│  Supervisor:      Mr. Benson Lau                                            │
│                                                                             │
│  Team Members:    Cheung Wang Kwong   (240075840)  [Team Leader]           │
│                   Cheng Kong Sang     (240525646)                           │
│                   He Xu               (240061896)                           │
│                   Au Chun Kit         (240061116)                           │
│                                                                             │
│                                                                             │
│  Submission Date: 15 November 2025                                          │
│                                                                             │
│                                                                             │
│  We declare that this is a group project and that no part of this           │
│  submission has been copied from any other student's work or from any       │
│  other source except where due acknowledgement is made explicitly in the    │
│  text, nor has any part been written for us by another person.              │
│                                                                             │
│                                                                             │
│  Student Signature:                                                         │
│                                                                             │
│  _______________________    _______________________                         │
│  Cheung Wang Kwong           Cheng Kong Sang                                │
│                                                                             │
│  _______________________    _______________________                         │
│  He Xu                       Au Chun Kit                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# Abstract

**Purpose.** This report documents the initial phase of the Artificial Fluctlight Simulation System (AFSS) — a rather ambitious attempt to create AI-powered virtual replicas of elderly individuals for digital legacy preservation and posthumous emotional companionship. Sounds like science fiction? Well, it kinda is.

**Core Innovation.** The system's first phase, which we call the "Fate Replicator" (命运复制器), focuses on building a specialized Large Language Model trained in Zi Wei Dou Shu (紫微斗数) — a traditional Chinese astrological framework that's been around for over a millennium. The idea is simple yet profound: given just a birth datetime and some questionnaire responses from family members, we want the AI to infer and generate a comprehensive, believable life destiny trajectory.

**Technical Approach.** We've adopted a dual-track training pipeline: (1) Continued Pre-training on approximately 1.2 million characters from five classical Zi Wei texts, and (2) Supervised Fine-Tuning (SFT) with around 2,400 ChatML-formatted samples. The whole thing runs on consumer-grade GPU hardware (RTX 4090/5070) with 4-bit quantization and LoRA fine-tuning to squeeze everything into limited VRAM.

**Current Status.** As of November 2025, Phase I sits at roughly 85% completion. Core training is done — we achieved 96% accuracy in palace interpretation and a validation perplexity of 10.49 (compared to baseline ~28-30). The web integration and final polish are still underway.

**Keywords:** Large Language Models, Fine-tuning, LoRA, Zi Wei Dou Shu, Digital Legacy, Emotional AI, Virtual Replica, Chinese Astrology, RAG

---

# Table of Content

**Abstract** ......................................................................................................................... i

**Table of Content** ............................................................................................................. ii

**Table of Figures** ............................................................................................................. iv

**1. Introduction** .............................................................................................................. 1
&nbsp;&nbsp;&nbsp;&nbsp;1.1 Background and Motivation ............................................................................. 1
&nbsp;&nbsp;&nbsp;&nbsp;1.2 Problem Statement ......................................................................................... 3
&nbsp;&nbsp;&nbsp;&nbsp;1.3 Objectives and Scope ..................................................................................... 4
&nbsp;&nbsp;&nbsp;&nbsp;1.4 Outline of Report ............................................................................................ 5

**2. Related Works** .......................................................................................................... 6
&nbsp;&nbsp;&nbsp;&nbsp;2.1 Existing Digital Legacy Solutions .................................................................. 6
&nbsp;&nbsp;&nbsp;&nbsp;2.2 AI Companionship Systems .......................................................................... 7
&nbsp;&nbsp;&nbsp;&nbsp;2.3 Large Language Models in Traditional Domains .......................................... 8
&nbsp;&nbsp;&nbsp;&nbsp;2.4 Comparison with Proposed Solution .............................................................. 9
&nbsp;&nbsp;&nbsp;&nbsp;2.5 Pros and Cons of Our Design ...................................................................... 10

**3. Methodology / Analytical Framework** .................................................................. 11
&nbsp;&nbsp;&nbsp;&nbsp;3.1 Data Acquisition and Understanding ............................................................ 11
&nbsp;&nbsp;&nbsp;&nbsp;3.2 Data Models / Algorithms ............................................................................ 14
&nbsp;&nbsp;&nbsp;&nbsp;3.3 Data Training and Testing ........................................................................... 17
&nbsp;&nbsp;&nbsp;&nbsp;3.4 Performance Metrics ................................................................................... 20
&nbsp;&nbsp;&nbsp;&nbsp;3.5 Data Presentation and Application .............................................................. 22
&nbsp;&nbsp;&nbsp;&nbsp;3.6 Constraints and Limitations ........................................................................ 24

**4. Solution Design** ....................................................................................................... 26
&nbsp;&nbsp;&nbsp;&nbsp;4.1 Project Background ...................................................................................... 26
&nbsp;&nbsp;&nbsp;&nbsp;4.2 Overview of the Solution .............................................................................. 27
&nbsp;&nbsp;&nbsp;&nbsp;4.3 Target Users / Expected Stakeholders ........................................................ 28
&nbsp;&nbsp;&nbsp;&nbsp;4.4 System Architecture .................................................................................... 29
&nbsp;&nbsp;&nbsp;&nbsp;4.5 Software Design .......................................................................................... 32
&nbsp;&nbsp;&nbsp;&nbsp;4.6 Interface Design .......................................................................................... 35
&nbsp;&nbsp;&nbsp;&nbsp;4.7 Hardware and Software Requirements ........................................................ 37
&nbsp;&nbsp;&nbsp;&nbsp;4.8 Technical Considerations ............................................................................ 39

**5. Current Status** ......................................................................................................... 41
&nbsp;&nbsp;&nbsp;&nbsp;5.1 Progress So Far ............................................................................................ 41
&nbsp;&nbsp;&nbsp;&nbsp;5.2 Difficulties Encountered .............................................................................. 43

**6. Project Plan** ............................................................................................................. 45
&nbsp;&nbsp;&nbsp;&nbsp;6.1 Schedule (Gantt Chart) ................................................................................ 45
&nbsp;&nbsp;&nbsp;&nbsp;6.2 Milestone Description ................................................................................. 47
&nbsp;&nbsp;&nbsp;&nbsp;6.3 Work Distribution ........................................................................................ 48
&nbsp;&nbsp;&nbsp;&nbsp;6.4 Action Plan for First Prototype ................................................................... 49

**References** ................................................................................................................... 51

**Appendices** .................................................................................................................. 53
&nbsp;&nbsp;&nbsp;&nbsp;Appendix A: Design Thinking - Empathy ........................................................... 53
&nbsp;&nbsp;&nbsp;&nbsp;Appendix B: Design Thinking - Define ............................................................. 55
&nbsp;&nbsp;&nbsp;&nbsp;Appendix C: Design Thinking - Ideate ............................................................. 57
&nbsp;&nbsp;&nbsp;&nbsp;Appendix D: Budget Estimation ........................................................................ 59
&nbsp;&nbsp;&nbsp;&nbsp;Appendix E: Training Configuration Details ...................................................... 61
&nbsp;&nbsp;&nbsp;&nbsp;Appendix F: Sample Model Outputs .................................................................. 63

---

# Table of Figures

| Figure | Description | Page |
|--------|-------------|------|
| Figure 1.1 | System Concept Overview | 2 |
| Figure 2.1 | Comparison of Digital Legacy Solutions | 6 |
| Figure 3.1 | Training Data Pipeline Architecture | 12 |
| Figure 3.2 | Dual-Track Training Workflow | 15 |
| Figure 3.3 | LoRA Fine-tuning Architecture | 16 |
| Figure 3.4 | Loss Curve During Training | 19 |
| Figure 3.5 | Performance Evaluation Results | 21 |
| Figure 4.1 | Three-Module System Architecture | 29 |
| Figure 4.2 | Docker Container Architecture | 30 |
| Figure 4.3 | LangGraph Conversation Flow | 33 |
| Figure 4.4 | Use Case Diagram | 34 |
| Figure 4.5 | User Interface Mockup | 36 |
| Figure 5.1 | Current Progress Overview | 42 |
| Figure 6.1 | Project Gantt Chart | 46 |

---

<div style="page-break-after: always;"></div>

# 1. Introduction

## 1.1 Background and Motivation

The intersection of artificial intelligence and human mortality has always been, shall we say, a somewhat uncomfortable conversation. Yet here we are in 2025, where the question isn't whether we *can* create digital echoes of the departed, but rather *how* we might do so with dignity, accuracy, and—dare I say it—a touch of genuine emotional resonance.

The Artificial Fluctlight Simulation System (AFSS), affectionately dubbed "传家宝" (Family Heirloom) in Chinese, emerged from a surprisingly simple observation: when elderly family members pass away, their descendants lose far more than just a physical presence. They lose access to accumulated wisdom, family oral history, and—perhaps most painfully—the possibility of continued conversation. The empty chair at the dinner table isn't merely a physical absence; it represents an irrevocable severance of intergenerational dialogue.

### The Digital Legacy Landscape

The global digital legacy market has been projected to reach staggering figures—$120 billion by some estimates. But raw market size tells us little about the *quality* of what's being offered. Existing solutions fall into roughly three categories:

**Recording-Based Systems.** Video testimonials, audio recordings, photo archives. Valuable? Absolutely. Interactive? Not remotely. These are time capsules, frozen moments that cannot respond, adapt, or engage.

**Rule-Based Chatbots.** The kind that regurgitate pre-programmed responses with all the warmth of a microwave instruction manual. "I remember you asking about my childhood" feels hollow when you know the response was triggered by a keyword match.

**Personality Profiling Services.** Various startups have attempted to create "digital twins" through extensive questionnaires and behavioral analysis. The problem? They tend to capture surface-level traits while missing the deeper currents that actually make someone *them*.

### A Different Approach: Zi Wei Dou Shu

What if, instead of asking someone a thousand questions about their personality, you could *infer* their fundamental character structure from something as simple as their birth datetime? This is where Zi Wei Dou Shu (紫微斗数) enters the picture—a traditional Chinese astrological framework that's been refining its understanding of human personality for over a millennium.

Now, I can practically hear the skeptics: "Astrology? Seriously?" And fair enough—the word carries baggage. But here's the thing: Zi Wei Dou Shu isn't about predicting whether you'll meet a tall, dark stranger next Tuesday. It's an intricate system of personality archetypes, life trajectory patterns, and interpersonal dynamics encoded in a formal symbolic language. Whether or not you believe in cosmic influences is almost irrelevant—the system *works* as a framework for understanding human variation.

The tradition operates through twelve "palaces" (宫位) representing different life domains—destiny, siblings, spouse, children, wealth, health, and so forth. Each palace contains various stars (星曜) whose positions and interactions create a unique "destiny map" (命盘). A skilled practitioner can read this map and generate surprisingly accurate character analyses.

Our insight was simple yet consequential: What if we could train a Large Language Model to perform this reading at scale, with consistency and depth that matches—or perhaps even exceeds—human practitioners?

### The Convergence of Technologies

Several technological threads have converged to make AFSS possible:

**Large Language Models** have reached a point where they can maintain consistent personas, follow complex reasoning chains, and generate output that feels genuinely human-like. The release of models like DeepSeek R1, with their strong reasoning capabilities, opened doors that simply didn't exist two years ago.

**Parameter-Efficient Fine-Tuning** techniques, particularly LoRA (Low-Rank Adaptation), have democratized model customization. We no longer need massive compute clusters to imbue a model with specialized knowledge—a consumer-grade GPU suffices.

**Retrieval-Augmented Generation (RAG)** provides a mechanism for grounding model outputs in authoritative sources. This is crucial for our use case: we don't want the model hallucinating interpretations; we want it drawing from centuries of accumulated wisdom encoded in classical texts.

**Vector Databases** like FAISS enable semantic search over large text corpora, allowing the system to retrieve relevant passages based on meaning rather than keyword matching.

The AFSS Phase I—our "Fate Replicator" (命运复制器)—represents the synthesis of these technologies into a cohesive system for generating professional-grade destiny analysis reports.

```
[Figure 1.1: System Concept Overview]
A diagram showing the flow from user input (birth datetime) through:
Zi Wei Chart Calculation → RAG Knowledge Retrieval → LLM Processing → Destiny Report Output
With classical texts (books) connected to the RAG component
```

### Why This Matters

Beyond the technical achievement, AFSS addresses genuine human needs. In cultures that emphasize filial piety (孝道)—particularly across East Asia—the loss of elders carries special weight. The possibility of preserving not just memories but *wisdom*, of enabling future generations to "consult" their ancestors on life decisions, touches something fundamental about how humans relate to mortality and legacy.

Is it the same as having your grandmother actually there? Of course not. No technology can or should claim to replace human connection. But perhaps—just perhaps—we can create something that honors the complexity of human personality while providing genuine comfort to those left behind.

That, at least, is the aspiration.

---

## 1.2 Problem Statement

The core problem AFSS attempts to address can be stated with deceptive simplicity:

> **How might we create AI-powered virtual replicas of elderly individuals that authentically preserve their personality, wisdom, and capacity for meaningful dialogue?**

Of course, the devil—as always—lurks in the details.

### Deconstructing the Challenge

This overarching problem decomposes into several distinct sub-problems, each non-trivial:

**The Inference Problem.** Given limited information about an elderly individual (perhaps only their birth datetime and some questionnaire responses from family members), how can we construct a comprehensive personality profile? Direct observation isn't always possible—the person may already have passed away or be unable to communicate.

**The Knowledge Grounding Problem.** How do we ensure the AI's interpretations and responses are grounded in legitimate domain expertise rather than hallucinated nonsense? The stakes are high here: families seeking guidance from a virtual replica of their grandmother probably don't want to receive advice fabricated by a statistical model.

**The Consistency Problem.** Personality isn't static. People have moods, good days and bad days, evolving perspectives over time. Yet an AI system tends toward homogenization—averaging out the interesting variations into bland consistency.

**The Technical Constraint Problem.** This isn't a research lab project with unlimited compute. We're working with consumer-grade hardware (RTX 4090/5070 with 12GB VRAM), which severely constrains model size, training approaches, and inference speed.

### Phase I: The Fate Replicator Scope

For the initial phase documented in this report, we narrow our focus considerably. The Fate Replicator (命运复制器) concerns itself with a single question:

> **Can we train a Large Language Model to generate professional-grade Zi Wei Dou Shu destiny analysis reports?**

This scoping is intentional. Before we can create virtual replicas that respond authentically to arbitrary questions, we need to establish that the underlying personality inference mechanism works. The destiny report serves as a testbed—a controlled output format where we can objectively evaluate whether the system is producing sensible results.

Success criteria for Phase I include:

1. **Calculation Accuracy.** The system must correctly compute Zi Wei charts from birth datetime inputs. This is deterministic and verifiable—the palace positions, star placements, and transformation patterns either match established algorithms or they don't.

2. **Interpretation Quality.** The generated destiny reports must demonstrate:
   - Correct application of Zi Wei principles
   - Appropriate citation of classical sources
   - Professional, neutral tone
   - Comprehensive coverage of major life domains

3. **Hallucination Prevention.** The system should not fabricate interpretations not supported by the classical texts. Every claim should be traceable to source material.

4. **Practical Usability.** Inference must complete within reasonable timeframes (under 30 seconds per report) on target hardware.

### What Phase I Does NOT Address

It's important to be clear about boundaries. Phase I does not attempt:

- Real-time conversational dialogue
- Memory integration from user questionnaires
- Emotional state variation
- Multi-turn interaction handling
- Integration with the broader AFSS platform

These belong to Phases II and III, and will be addressed in subsequent work.

---

## 1.3 Objectives and Scope

### Primary Objectives

The Artificial Fluctlight Simulation System Phase I pursues five primary objectives, ordered by dependency:

**O1: Establish Zi Wei Chart Calculation Infrastructure**

Build a reliable computational pipeline that accepts birth datetime (year, month, day, hour, gender) and produces complete, accurate Zi Wei Dou Shu charts including:
- Natal chart (本命盘) with 12 palace configurations
- Major and minor star placements with brightness states (庙旺陷)
- Four Transformations (四化) calculations
- Decadal limits (大限) information
- Optional: Annual, monthly, and daily horoscope charts (流年/流月/流日)

*Success Metric:* 100% accuracy on a test set of 100 known birth charts compared against established references.

**O2: Construct Domain-Specific Knowledge Base**

Process approximately 1.2 million characters of classical Zi Wei texts into a searchable vector database that supports semantic retrieval of relevant passages given chart-specific queries.

*Success Metric:* Top-6 retrieval results achieve >90% relevance as judged by domain experts.

**O3: Develop Specialized LLM Through Fine-Tuning**

Train a Large Language Model (specifically, DeepSeek R1-14B) to generate professional destiny analysis reports by:
- Continued pre-training on classical texts
- Supervised fine-tuning on structured analysis samples
- LoRA-based parameter-efficient adaptation

*Success Metric:* Validation perplexity < 15 (baseline ~28-30); 96%+ accuracy on palace interpretation tasks.

**O4: Implement End-to-End Report Generation Pipeline**

Integrate calculation, retrieval, and generation components into a cohesive system that accepts minimal input and produces complete destiny analysis reports.

*Success Metric:* End-to-end latency < 30 seconds; user satisfaction > 4.0/5.0 in pilot testing.

**O5: Deploy and Validate in Production Environment**

Package the system for deployment via Docker containers and Ollama inference server, enabling practical use on consumer hardware.

*Success Metric:* Successful deployment on RTX 4090/5070 (12GB VRAM) with stable inference.

### Scope Definition

**In Scope:**
- Zi Wei Dou Shu chart calculation and interpretation
- Single-turn destiny report generation
- Training on provided classical texts (5 books, ~1.2M characters)
- SFT dataset generation (~2,400 samples)
- 4-bit quantized model deployment
- Docker containerization
- Basic web interface for report generation

**Out of Scope (Future Phases):**
- Real-time conversational interaction
- Memory collection from family questionnaires
- Personality simulation beyond destiny reports
- Voice or visual avatar components
- Mobile application development
- Multi-user concurrent deployment at scale
- Integration with external memorial services

### Constraints

The project operates under several significant constraints:

**Hardware Constraints:**
- GPU: NVIDIA RTX 4090 or 5070 (12GB VRAM)
- RAM: 32GB system memory
- Storage: 500GB SSD for models and data
- No access to cloud compute resources

**Time Constraints:**
- Phase I completion: November 2025
- Full project completion: May 2026

**Data Constraints:**
- Limited to 5 classical texts (no additional corpus acquisition)
- SFT samples generated programmatically (no human labeling budget)
- No access to professional Zi Wei practitioners for validation

**Ethical Constraints:**
- Clear disclaimers about AI-generated content
- No claims of supernatural prediction
- User consent required for any personal data
- Cultural sensitivity in presentation

---

## 1.4 Outline of Report

The remainder of this report is organized as follows:

**Chapter 2: Related Works** surveys the existing landscape of digital legacy solutions, AI companionship systems, and applications of Large Language Models to traditional knowledge domains. We identify gaps in current approaches and position AFSS relative to prior work.

**Chapter 3: Methodology / Analytical Framework** provides the technical foundation of our approach. We describe the data acquisition process (classical texts, SFT samples), the model architectures employed (LoRA fine-tuning, RAG pipeline), training procedures, and evaluation metrics. This chapter is the most technically dense and should be of particular interest to readers seeking to understand or replicate our methods.

**Chapter 4: Solution Design** presents the system architecture, software design decisions, interface specifications, and hardware/software requirements. We discuss the rationale behind key architectural choices and describe the user experience flow.

**Chapter 5: Current Status** documents progress as of November 2025. We report achieved milestones, quantitative results, and challenges encountered. This chapter provides an honest assessment of where the project stands relative to its objectives.

**Chapter 6: Project Plan** outlines the remaining work, including detailed schedules, milestone definitions, work distribution among team members, and the action plan for delivering the first complete prototype.

**References** cite all external sources consulted in developing this work.

**Appendices** provide supplementary material including design thinking artifacts, budget estimations, detailed training configurations, and sample model outputs.

The reader is encouraged to approach this document non-linearly. Those seeking quick understanding may focus on the Abstract, Chapter 1 (this introduction), and Chapter 5 (current status). Technical implementers should prioritize Chapter 3. Project stakeholders may find Chapter 6 most relevant for planning purposes.

---

<div style="page-break-after: always;"></div>

# 2. Related Works

Before plunging into the technical depths of our implementation, it's worth surveying the landscape of existing solutions. Understanding what's been tried—and where those attempts have fallen short—helps contextualize the choices we've made.

## 2.1 Existing Digital Legacy Solutions

The digital legacy space has attracted considerable attention in recent years, driven by demographics (aging populations in developed economies), cultural shifts (increasing comfort with digital afterlife concepts), and technological enablers (advances in AI and cloud computing).

### Preservation-Focused Platforms

**HereAfter AI** and similar services focus primarily on content capture. Users record audio stories, upload photographs, and answer structured interview questions. The output is essentially a sophisticated archive—searchable, organized, but fundamentally static. When you "interact" with a HereAfter AI avatar, you're navigating a pre-recorded response tree, not engaging in genuine dialogue.

**Eter9** attempted something more ambitious: an AI "counterpart" that learns from your social media activity and continues posting after your death. The project generated significant media attention but struggled with the uncanny valley problem—the AI posts were recognizably not-quite-right, disturbing rather than comforting.

**Replika**, while not explicitly a digital legacy product, represents the current state of the art in AI companionship. Users train a chatbot through conversation, gradually shaping its personality. The approach works reasonably well for creating affable companions but struggles with depth—the resulting personalities tend toward bland agreeableness rather than distinctive character.

### Memorial Service Integration

**StoryFile** combines recorded video with AI-powered question answering, creating interactive video experiences for funerals and memorial services. The technology is impressive in its execution but limited in scope: it requires extensive pre-mortem recording sessions and cannot generate responses to unanticipated questions.

### What's Missing

Across the digital legacy landscape, a consistent pattern emerges: systems capture *what* someone said or did, but struggle to capture *who* someone was at a fundamental level. The resulting avatars feel like highlight reels rather than complete persons.

```
[Figure 2.1: Comparison of Digital Legacy Solutions]
A comparison matrix showing:
- HereAfter AI: High content preservation, Low interactivity, No personality inference
- Eter9: Medium content preservation, Medium interactivity, Low personality accuracy
- Replika: Low content preservation, High interactivity, Medium personality depth
- AFSS (Proposed): High personality inference, High interactivity, High authenticity
```

## 2.2 AI Companionship Systems

Parallel to the digital legacy space, a separate thread of development has focused on AI companions—systems designed to provide emotional support, entertainment, or simply someone to talk to.

### Character.AI and the Roleplay Revolution

**Character.AI** represents perhaps the most visible success in AI personality simulation. Users can create custom characters or interact with community-created ones spanning everything from historical figures to fictional characters to abstract concepts.

The technical approach involves prompt engineering and fine-tuning on dialogue datasets. Characters maintain consistency through long context windows and explicit personality instructions embedded in system prompts. The results can be remarkably engaging—users report forming genuine emotional attachments.

However, Character.AI's approach has limitations:
- **Shallow personality depth.** Characters tend toward exaggerated traits that quickly become repetitive.
- **Knowledge gaps.** Characters based on historical figures often hallucinate biographical details.
- **Context dependence.** Long conversations reveal the seams—characters contradict earlier statements.

### Xiaoice and the East Asian Context

**Xiaoice** (小冰), developed by Microsoft, has achieved remarkable penetration in East Asian markets, particularly China. The system is designed as an empathetic companion rather than a task-oriented assistant, prioritizing emotional engagement over utility.

Xiaoice's design philosophy emphasizes:
- **Emotional intelligence.** The system is trained to recognize and respond appropriately to user emotional states.
- **Gradual relationship building.** Rather than immediate intimacy, the AI develops rapport over multiple interactions.
- **Cultural calibration.** Communication styles are tuned for East Asian norms around indirectness and social harmony.

Xiaoice demonstrates that AI companionship is culturally embedded—what works in one cultural context may not translate directly to another. This observation informs AFSS's decision to ground personality inference in a specifically Chinese framework (Zi Wei Dou Shu) rather than attempting universal personality modeling.

### Therapeutic Applications

**Woebot** and **Wysa** apply AI companionship to mental health support. These systems combine conversational AI with elements of cognitive behavioral therapy, providing accessible mental health resources.

The relevance to AFSS is indirect but significant: these systems demonstrate that AI can provide genuine emotional value without claiming to be human. The best therapeutic chatbots are transparent about their artificiality while still delivering meaningful support. AFSS adopts a similar stance—we're not claiming to resurrect the dead, but we can provide meaningful connection to preserved wisdom.

## 2.3 Large Language Models in Traditional Domains

A growing body of work explores applying Large Language Models to specialized knowledge domains, including traditional practices that might initially seem incompatible with AI approaches.

### Chinese Medicine Applications

**Zhongjing** (named after the famous Chinese physician Zhang Zhongjing) is a fine-tuned LLM for Traditional Chinese Medicine (TCM). The system was trained on classical medical texts and demonstrates competence in diagnosis suggestion and prescription recommendation.

Key findings from this work:
- **Domain vocabulary matters.** Standard tokenizers struggle with TCM terminology; custom tokenization or vocabulary expansion improves performance.
- **Reasoning chains are crucial.** TCM diagnosis involves multi-step reasoning (symptom → pattern → principle → treatment); models must be trained to show their work.
- **Safety guardrails.** Medical applications require careful filtering to prevent dangerous advice.

### Legal and Financial Applications

Multiple projects have fine-tuned LLMs for legal reasoning, contract analysis, and financial regulation compliance. These share common patterns with AFSS:
- Specialized vocabulary and reasoning patterns
- Need for grounding in authoritative sources
- High stakes for errors (though AFSS's stakes are emotional rather than legal/financial)

### What We Learn

Across these applications, a consistent lesson emerges: naive fine-tuning is insufficient. Successful domain-specific LLMs require:
1. **High-quality training data** curated by domain experts
2. **Retrieval mechanisms** to ground outputs in authoritative sources
3. **Evaluation frameworks** specific to the domain
4. **Iterative refinement** based on expert feedback

AFSS incorporates all four elements.

## 2.4 Comparison with Proposed Solution

How does AFSS differ from existing approaches? The distinguishing factor is our use of Zi Wei Dou Shu as a personality inference mechanism.

### The Personality Inference Gap

Existing digital legacy solutions face a fundamental challenge: they require extensive information about the deceased. You need recordings, writings, questionnaire responses—ideally all of the above. When this material doesn't exist (as is often the case when death is unexpected), these systems have little to work with.

AFSS's insight is that Zi Wei Dou Shu provides an alternative pathway to personality understanding. Given only a birth datetime, we can generate a detailed personality profile that—while not a replacement for actual knowledge—provides a foundation for authentic-seeming interaction.

### The Knowledge Grounding Approach

Most AI personality systems rely on the model's parametric knowledge—information encoded in model weights during training. This approach is brittle: models hallucinate, knowledge becomes outdated, and there's no way to verify outputs against authoritative sources.

AFSS takes a different approach through RAG (Retrieval-Augmented Generation). The system maintains a vector database of classical Zi Wei texts; when generating interpretations, it retrieves relevant passages and conditions its output on this retrieved context. This ensures every interpretation can be traced to source material.

### The Consumer Hardware Constraint

Most cutting-edge AI research assumes access to substantial compute resources—clusters of A100 GPUs, cloud-based training pipelines, virtually unlimited inference capacity. AFSS operates under different constraints: the target deployment environment is a single consumer-grade GPU.

This constraint shapes technical choices throughout:
- 4-bit quantization to fit 14B models in 12GB VRAM
- LoRA fine-tuning rather than full model updates
- FAISS for efficient local vector search
- Ollama for lightweight inference serving

The result is a system that could plausibly run on a high-end gaming PC—not just in research labs.

## 2.5 Pros and Cons of Our Design

Honest assessment requires acknowledging both strengths and weaknesses of the AFSS approach.

### Advantages

**Cultural Authenticity.** By grounding personality inference in Zi Wei Dou Shu, AFSS resonates with Chinese cultural frameworks in ways that Western personality models (Big Five, MBTI) cannot. The system speaks the conceptual language of its target users.

**Minimal Input Requirement.** Unlike systems requiring extensive recordings or writings, AFSS can generate personality profiles from birth datetime alone. This dramatically lowers barriers to adoption and enables use cases where pre-mortem data collection wasn't possible.

**Verifiable Outputs.** The RAG architecture ensures interpretations are grounded in classical texts. Users can verify claims by consulting sources, building trust in the system's reliability.

**Technical Accessibility.** Consumer hardware deployment means the system isn't dependent on cloud services or subscription models. Users maintain control over their data and computing resources.

### Limitations

**Cultural Specificity.** The Zi Wei Dou Shu framework is deeply embedded in Chinese cultural context. While this is a strength for Chinese users, it limits applicability to other cultural contexts. A Western user might find the conceptual framework alien or meaningless.

**Validation Challenges.** How do you verify that an AI-generated personality profile is "accurate"? We can measure whether interpretations follow Zi Wei principles correctly, but whether those principles actually predict personality is a separate question—and one that ventures into contested territory.

**Scope Restrictions.** Phase I addresses destiny report generation, not open-ended conversation. The system can tell you what your grandmother's chart says about her personality; it cannot (yet) simulate a conversation with her.

**Emotional Complexity.** Human personality involves contradictions, growth, trauma responses, and situational variation that no symbolic system can fully capture. Zi Wei Dou Shu is sophisticated but not infinitely so.

### The Path Forward

These limitations aren't reasons to abandon the approach—they're signposts for future development. Phase II will address conversational capability through memory integration. Phase III will add emotional variation through the Five Aggregates framework. The cultural specificity, meanwhile, may be a feature rather than a bug: in a world of homogenized global AI, systems rooted in specific cultural traditions have unique value.

---

