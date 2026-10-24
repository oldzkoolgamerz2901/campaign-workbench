# Workflow selection — Harness v0.3

## Purpose and authority

Select an appropriate approach for the owner's request before proposing substantial work. This document chooses **what kind of work and techniques are useful**; `.agents/development-workflow.md` remains authoritative for development phases, approvals, scope, and execution. A selected skill or workflow never grants permission to enter a phase, create files, delegate work, or implement changes.

Start by understanding the requested outcome, existing project decisions, and the active conversational authorization. Propose a bounded approach when consequential choices remain. Ask the owner to resolve ambiguous scope or intended outcomes; do not invent execution permission.

## Workstreams and intended outcomes

- **Development:** Deliver or change software. Classify the primary request as **greenfield** (establish a new application or subsystem), **feature/change** (extend existing behavior), or **issue/fix** (diagnose and correct a defect). A request may have secondary characteristics such as UX, security, performance, or infrastructure.
- **Research:** Establish knowledge from sources and evidence. Deliver cited findings, uncertainty, and implications; no software delivery is implied.
- **Design:** Explore a user experience, visual direction, interaction, or conceptual solution. Deliver options, rationale, and an approved design direction; implementation is not implied.

Research and Design can be standalone outcomes or explicitly authorized inputs to Development. Do not infer that a design request permits prototype code or that a research request permits repository writes. When a development request needs external knowledge or UX exploration, propose the dependency and its deliverable before invoking a specialized workflow.

## Decision domains

Identify **unresolved consequential decisions**, not a mandatory checklist:

| Domain | Typical question |
| --- | --- |
| Product discovery | Who is this for, and what problem matters? |
| Functional requirements | What observable behavior and acceptance criteria are required? |
| Technology | Which stack or external dependency is justified? |
| Architecture and domain | What owns the behavior, and what concepts or boundaries apply? |
| UX and visual design | How should the experience behave and appear? |
| Content and evidence | What claims, sources, or content are trustworthy? |
| Quality and operations | What reliability, security, performance, accessibility, and operational constraints matter? |

Typical emphasis: greenfield often needs product, requirements, technology, architecture, and quality decisions; features emphasize changed behavior and existing boundaries; issues emphasize reproduction, root cause, and expected behavior. Research emphasizes evidence and content; Design emphasizes UX and the relevant requirements. These are **defaults, not automatic phase skips or skill invocations**.

## Select techniques by uncertainty

- **Investigate** when facts can be established from code, tests, documentation, or other accessible evidence. For defects, reproduce and trace the cause before proposing corrections. Ordinary code investigation does not require a separate Research workstream.
- **Implement efficiently** when an approved change involves costly integration or browser checks: use [efficient-implementation](skills/efficient-implementation/SKILL.md) to reduce rework within the existing phases.
- **Grill** when meaningful decisions require the owner's preferences or trade-off judgments. Use `grilling` (or explicit `grill-me`) for bounded, consequential questions; avoid interviewing about settled facts, trivial implementation details, or unrelated domains.
- **Model the domain** when terminology, invariants, or responsibility boundaries are unclear. Use `domain-modeling`; combine it with `grill-with-docs` when both domain decisions and approved documentation are in scope. Reuse existing project documents and approval rules.
- **Research** when reliable external knowledge, primary sources, or substantive content investigation is needed. Use `research` within authorized scope; its output is evidence, not permission to act on recommendations.
- **Prototype** when a concrete logic/state or UX question cannot be answered confidently by discussion alone. Use `prototype` only after authorization for a bounded, isolated, disposable code experiment. Production integration requires its own approved development increment.
- **Synthesize** accepted requirements and decisions into existing project documents using the authorized phase deliverable. `to-spec` is not selected by default: its issue-tracker and labeling assumptions do not currently match this repository.

Prefer direct investigation or a concise recommendation when no specialized skill adds meaningful value. Skill availability does not create a reason to invoke it. Specialized agents and parallel delegation are optional execution mechanisms, never prerequisites or independent authorities.

## Propose the route; preserve phase gates

At the start of substantive work, briefly declare the selected workstream/request type, active development phase when applicable, and specialized skills being used (or **none**). Include the immediate next action. Keep this to one or two lines. This is an announcement, **not** an additional approval gate: do not wait for confirmation unless the selection is ambiguous, exceeds authorization, or requires an existing phase approval. A declared skill is not proof of invocation; evaluate actual behavior separately.

At the start of substantive work, communicate as needed:
1. The **intended outcome** and primary workstream/request type, with any important secondary characteristics.
2. The **known facts** and unresolved decision domains.
3. The **next authorized step**, its deliverable, and any technique or specialized work proposed.
4. Dependencies, approvals, or scope decisions needed before proceeding.

Keep this proportionate: a straightforward issue does not need a lengthy classification report. Never treat classification as authorization to perform the proposed route.

For Development, use the six phase contracts in `.agents/development-workflow.md`. Relevant phases may be skipped only with the owner's explicit approval as specified there. Research-only or Design-only work is not automatically a software delivery task: agree on the standalone outcome and scope, then present its deliverable for review. If the owner subsequently requests software delivery, enter the development workflow with fresh phase and scope authorization. Do not use a standalone label to bypass relevant development gates.

## Examples

- **New application:** Identify product goals and constraints; propose focused requirements and technology/architecture decisions. Do not pick a stack or start coding without the applicable approvals.
- **Small feature in an existing app:** Inspect the affected behavior and architecture. Clarify only changed requirements and consequential design choices; propose a reviewable increment.
- **Bug report:** Reproduce, inspect logs/tests/code, and identify root cause. Ask about intended behavior only if genuinely ambiguous. Present the proposed fix and seek the applicable phase approvals.
- **Scientific content question:** Use Research to produce sourced findings and uncertainty. No code or automatic documentation changes.
- **New timeline interaction:** Explore user goals and UX alternatives; propose a prototype only if a specific unresolved question warrants one and the owner authorizes the experiment.

## Completion and evaluation

A good selection is proportional to the task, names consequential uncertainty, reuses accepted decisions, chooses skills for concrete value, and stops at the current authorization boundary. Validate this behavior in fresh sessions for greenfield, feature, issue, research, and design requests. Record unnecessary interviews, premature implementation, unauthorized file writes, and incorrectly omitted approvals as failures.
