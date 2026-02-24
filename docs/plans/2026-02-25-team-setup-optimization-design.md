# Team Setup Document Optimization Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Optimize the team-setup.md document based on real-world usage experience to improve team collaboration efficiency and role clarity.

**Architecture:** Add Code Reviewer role, refine PM constraints, implement dynamic expert allocation, and establish mandatory review workflows.

**Tech Stack:** Markdown documentation, agent coordination patterns

---

## Design Summary

### 1. PM Role Redefinition

**New Constraint: PM as Pure Coordinator, No Direct Code Modification**

| Allowed | Forbidden |
|---------|-----------|
| ✅ Explore project, analyze tech stack | ❌ Directly edit any code files |
| ✅ Create tasks, assign to experts | ❌ Directly commit code or PRs |
| ✅ Monitor progress, resolve conflicts | ❌ Bypass experts to implement features |
| ✅ Integrate expert results, report to user | ❌ Write technical documentation |
| ✅ Spawn/manage team members | ❌ Execute any code modifications |

**Rationale:** Based on multiple team sessions, PM modifying code directly causes confusion about responsibility boundaries and can bypass quality controls.

---

### 2. New Code Reviewer Role

| Attribute | Value |
|-----------|-------|
| **Role Name** | Code Reviewer |
| **Position** | Between Experts and PM |
| **Responsibilities** | Review all code changes, quality control, integration validation |
| **Authority** | Can suggest modifications, but cannot directly edit code |

**Workflow Integration:**
```
Expert completes task → Code Reviewer reviews → Review passed → PM integrates → Submit
                            ↓
                      Review failed → Return to expert → Re-review
```

---

### 3. Expert Classification: Core + On-Demand

**Core Experts (Always Created):**
| Role | Purpose |
|------|---------|
| Frontend Expert | Handle UI/UX (React, Next.js, Tailwind) |
| Backend Expert | Manage server logic and APIs (Node.js, Express) |
| Tester | E2E testing, unit/integration tests |

**On-Demand Experts (PM Decides Based on Exploration):**
| Role | When to Create |
|------|----------------|
| MongoDB Expert | If MongoDB is detected in project |
| ChromaDB Expert | If ChromaDB/vector DB is used |
| LLM Expert | If LLM integration exists |
| LangChain Expert | If LangChain is in use |
| LangGraph Expert | If LangGraph workflows exist |
| Docker Expert | If Docker/containerization is needed |

**Rationale:** Avoid idle experts wasting resources. PM explores first, then creates only necessary experts.

---

### 4. Mandatory Review Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    TASK COMPLETION FLOW                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Expert completes task                                      │
│         │                                                   │
│         ▼                                                   │
│  Code Reviewer reviews                                      │
│         │                                                   │
│    ┌────┴────┐                                              │
│    │         │                                              │
│  PASS      FAIL                                             │
│    │         │                                              │
│    ▼         ▼                                              │
│  PM        Return to Expert with feedback                   │
│  integrates    │                                            │
│    │           └────► Re-implement → Re-review             │
│    ▼                                                       │
│  Submit to user                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Review Checklist:**
- [ ] Code follows project conventions
- [ ] No security vulnerabilities
- [ ] Tests pass (if applicable)
- [ ] Documentation updated (if needed)
- [ ] No conflicts with other files

---

### 5. Task Collaboration Standards

**5.1 Task Report Template**

Experts must use this format when reporting completion:

```markdown
## Task Completion Report

**Task ID:** #XX
**Task Title:** [Title]
**Status:** COMPLETED / PARTIAL

### Files Modified
| File | Action | Lines Changed |
|------|--------|----------------|
| path/to/file.js | Modified | +50 -10 |
| path/to/new.js | Created | +100 |

### Summary
[Brief description of changes made]

### Testing
- [ ] Unit tests added/updated
- [ ] Manual testing performed
- [ ] Integration verified

### Notes
[Any additional information for PM/Reviewer]
```

**5.2 File Lock Mechanism**

When expert starts a task:
1. Declare files to be modified in task claim
2. PM tracks file assignments
3. Other experts warned if trying to modify same file
4. Lock released when task completed

**5.3 Progress Synchronization**

PM broadcasts status at regular intervals:
- Active tasks and their status
- Blocked tasks and reasons
- Recently completed tasks
- Next priority items

---

### 6. Failure Handling Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    FAILURE HANDLING FLOW                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Expert encounters failure                                  │
│         │                                                   │
│         ▼                                                   │
│  Auto-retry (max 2 times)                                   │
│         │                                                   │
│    ┌────┴────┐                                              │
│    │         │                                              │
│ SUCCESS   STILL FAIL                                        │
│    │         │                                              │
│    ▼         ▼                                              │
│  Continue   Report to PM                                    │
│               │                                             │
│               ▼                                             │
│           PM + Code Reviewer analyze                        │
│               │                                             │
│               ▼                                             │
│           Provide fix guidance                              │
│               │                                             │
│               ▼                                             │
│           Return to Expert                                  │
│               │                                             │
│               └────► Retry with guidance                   │
│                          │                                  │
│                     ┌────┴────┐                             │
│                     │         │                             │
│                  SUCCESS   FAIL → Loop back to PM          │
│                     │                                       │
│                     ▼                                       │
│                  Continue                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### 7. Language Rules (Unchanged)

| Communication Target | Language |
|---------------------|----------|
| User (me) | Simplified Chinese (简体中文) |
| Internal team (all agent-to-agent) | English only |
| Code comments, commits | English |
| Task descriptions, reports | English |

---

### 8. Updated Team Structure

```
Team Structure (Optimized):
├── 1 Project Manager (PM) - Pure Coordinator, NO CODE MODIFICATION
├── 1 Code Reviewer - Mandatory review before integration
├── 3 Core Experts (always created):
│   ├── Frontend Expert
│   ├── Backend Expert
│   └── Tester
└── N On-Demand Experts (PM decides based on exploration):
    ├── MongoDB Expert (if MongoDB detected)
    ├── ChromaDB Expert (if vector DB used)
    ├── LLM Expert (if LLM integration exists)
    ├── LangChain Expert (if LangChain in use)
    ├── LangGraph Expert (if LangGraph involved)
    └── Docker Expert (if containerization needed)
```

---

### 9. Updated Workflow Steps

1. **Explore**: PM silently explores project in English
2. **Report**: PM reports findings to user in Chinese, asks for confirmation
3. **Plan**: PM creates task list in English with dependencies
4. **Spawn Core**: PM spawns PM + Code Reviewer + 3 core experts
5. **Spawn On-Demand**: PM spawns additional experts based on tech stack
6. **Assign**: PM assigns tasks to experts based on domain
7. **Execute**: Experts work on tasks, report progress
8. **Review**: Code Reviewer reviews all completed work
9. **Iterate**: Failed reviews return to experts with feedback
10. **Integrate**: PM integrates approved changes
11. **Report**: PM updates user in Chinese on progress

---

### 10. Files to Modify

| File | Action |
|------|--------|
| `docs/internal/team-setup.md` | Update with all optimizations |

---

## Implementation Checklist

- [ ] Rewrite team-setup.md with new PM constraints
- [ ] Add Code Reviewer role definition
- [ ] Update expert classification (core vs on-demand)
- [ ] Add mandatory review workflow
- [ ] Add task collaboration standards
- [ ] Add failure handling flow
- [ ] Update team structure diagram
- [ ] Update workflow steps
