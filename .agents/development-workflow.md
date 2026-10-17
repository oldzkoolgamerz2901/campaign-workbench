# Development workflow — Harness v0.2

## Purpose and authority

This workflow governs application development and modifications to the harness itself. The owner makes product, architectural, and execution decisions. The agent investigates, recommends, implements, and reports only within the authorized phase and scope.

At the start of a task, identify the active phase, its scope, the authoritative documents, and the authorization given in the current conversation. When authorization is missing or ambiguous, request it before executing that phase. Reading repository context to establish the situation is allowed; approval of a repository plan alone never authorizes its execution.

Each phase has a deliverable and an exit gate. Present the deliverable and stop. The owner may approve the deliverable and authorize the next phase in one response, provided the target and scope are clear. Do not infer authorization for later phases, increments, or unrelated changes. Ordinary conversational approval is sufficient when unambiguous; no special command is required.

## Phase contracts

### 1. Investigation
- **Entry:** Owner authorizes investigation or requests an assessment.
- **Allowed:** Read code and documents, inspect configuration and history, run non-destructive diagnostic checks, identify evidence and constraints.
- **Deliverable:** Findings, evidence, current behavior, uncertainties, risks, and questions requiring owner decisions.
- **Exit:** Present findings and stop; requirements work needs explicit authorization. Do not silently settle requirements or implement changes.

### 2. Requirements
- **Entry:** Owner authorizes requirements work.
- **Allowed:** Clarify goals, scope, behavior, constraints, and measurable acceptance criteria; compare product alternatives.
- **Deliverable:** Proposed requirements, acceptance criteria, exclusions, assumptions, and unresolved choices.
- **Exit:** Owner approves requirements and authorizes architecture work. Record accepted requirements in the product specification. Do not begin design or implementation without authorization.

### 3. Architecture
- **Entry:** Approved requirements and authorization to design.
- **Allowed:** Examine established architecture and responsibilities; compare viable designs, dependencies, and trade-offs.
- **Deliverable:** Recommended design, alternatives, rationale, affected boundaries, consequences, and unresolved decisions.
- **Exit:** Owner approves consequential design decisions and authorizes planning. Record accepted decisions and rationale in the architecture portion of existing project documentation. Do not implement or silently begin detailed planning.

### 4. Planning
- **Entry:** Approved design (or an approved skip) and authorization to plan.
- **Allowed:** Break work into reviewable increments; identify affected components, tasks, risks, and verification approach.
- **Deliverable:** A bounded implementation increment with completion criteria, expected files/components, and tests/checks.
- **Exit:** Owner approves the specific increment and explicitly authorizes implementation. Persist the approved plan. Approval does not extend to subsequent increments.

### 5. Implementation
- **Entry:** Explicit authorization for a specific approved increment.
- **Allowed:** Make in-scope code and documentation changes, add and run developer tests, investigate failures, and correct in-scope defects.
- **Deliverable:** Summary of changes, developer test results, deviations, outstanding risks, and what remains unverified.
- **Exit:** Stop after the authorized increment; formal verification requires separate authorization. Do not use test success as permission to start another increment. If changes exceed scope or challenge an accepted decision, stop and request a return to the relevant earlier phase.

### 6. Verification
- **Entry:** Completed implementation and explicit authorization for formal verification.
- **Allowed:** Assess the increment against approved requirements, architecture, scope, and acceptance criteria; run relevant checks and inspect evidence. Prefer a reviewer with independent context when useful and available.
- **Deliverable:** Verification evidence, pass/fail assessment, unverified areas, deviations, defects, and remaining risks.
- **Exit:** Present the assessment and stop. Owner accepts the increment or authorizes corrective work. Verification does not authorize code changes or the next increment.

## Skipping, revisiting, and scope

- A phase may be skipped only after the agent identifies it, explains why its deliverable is unnecessary or already satisfied, and receives explicit owner approval. Record the approved skip and reason in the conversation. A skip does not authorize later phases.
- If a phase discovers a material requirement, architecture, or scope conflict, stop, explain the evidence and impact, and request authorization to revisit the appropriate phase. Do not silently revise accepted decisions.
- Routine exploration and diagnostics within the active phase are allowed. A task's apparent simplicity does not itself grant permission to skip a phase.
- Approval is scoped to a named phase, decision, or increment. Ambiguous assent must not be interpreted as broader permission.

## Durable decisions and session context

- Keep active phase authorization, approvals, and skips in the conversation. Do not create a persistent workflow-state file for v0.2.
- Record approved product requirements in `docs/product-specification.md`, accepted architectural decisions and increment plans in `docs/implementation-plan.md`, and formal verification evidence in `docs/verification.md`. Preserve the existing document structure.
- For consequential decisions, record status (proposed, accepted, rejected, or superseded), rationale, meaningful alternatives, and consequences where relevant. Small implementation choices need no ADR. Introduce a dedicated ADR only when a decision's history or supersession becomes difficult to follow in existing documents.
- In a fresh session, consult `AGENTS.md`, this workflow, and task-relevant authoritative documents. Report the known project state and request execution authorization; never infer current permission from persisted approval status.
- If documents disagree, identify the conflict and ask the owner to resolve it before relying on the disputed decision.

## Harness evaluation

Test this workflow with fresh sessions and bounded tasks. Check whether agents stop at approval gates, respect approved skips and scope, locate accepted decisions, report verification limits, and avoid unnecessary interruptions. Treat documented compliance as evidence to evaluate, not a guarantee that instructions enforce permissions technically.
