# Agent Instructions

## Project context

- Read `.agents/development-workflow.md` before starting or resuming development work, including changes to this harness. Its phase contracts and approval gates are mandatory.
- Read `.agents/workflow-selection.md` to classify the requested outcome, identify unresolved decision domains, and select useful skills. Workflow selection never grants execution authorization.
- Use `README.md` to orient yourself. Consult `docs/product-specification.md` for approved requirements, `docs/implementation-plan.md` for accepted architecture and increment scope, and `docs/verification.md` for formal verification evidence when that file exists; developer-check results belong in `docs/implementation-plan.md`.
- For historical assessment evidence only, consult `../sea_witch/repository-app-assessment.md`. It contains proposals, not approved requirements. Campaign content belongs to independent repositories and is outside application edit scope.
- Distinguish authoritative accepted decisions from proposals. Repository approval of a plan is not authorization to execute it in this session.

## Mandatory pre-action checkpoint

Before any tool action that creates, modifies, deletes, or commits application code, tests, configuration, or repository documentation, check all four conditions against the **current conversation**:

1. **Phase:** The active development phase is identified.
2. **Permission:** The action is allowed in that phase.
3. **Authorization:** Explicit owner approval exists for this phase and, for implementation, the specific increment. An instruction to achieve an outcome (for example, "remove this caption") is not by itself approval to skip intervening phases.
4. **Scope:** The target files and intended effects fit the approved scope.

If any condition is missing, **do not perform the write**. State the missing authorization or phase decision and request it. A simple or obvious change is not an exception. Approved phase skips must be explicit and do not automatically authorize implementation. Recheck before the first write after investigation and whenever scope changes.

For operational commands such as starting an existing development server, distinguish non-mutating operation from development work; announce the classification and do not use operational permission to justify code edits. This is an instruction-level checkpoint, not a technical permission barrier.

## Investigate and design

- Inspect relevant code, configuration, documentation, and existing design decisions before proposing changes. Base conclusions on evidence.
- Evaluate every solution against the overall architecture. Explain how it fits existing responsibilities and boundaries, or why a design change is justified.
- Keep behavior with the component that owns it. Respect dependency boundaries and avoid unnecessary coupling.
- Prefer the simplest maintainable solution that satisfies the requirements. Add infrastructure, dependencies, and abstractions only for a demonstrated need.
- Distinguish verified facts, assumptions, risks, and recommendations. Investigate accessible facts rather than asking the owner to supply them.
- Present meaningful architectural choices and tradeoffs for approval before implementing them.

## Collaborate and execute

- Treat the owner as the decision-maker for product scope and consequential architecture choices. Offer candid technical recommendations and challenge assumptions when evidence warrants it.
- Keep work scoped to the requested task. Planning or investigation does not authorize implementation.
- For implementation tasks, agree on a small, reviewable scope before changing code. Make focused changes and avoid unrelated refactoring.
- Follow the repository's established technology choices, conventions, and documented decisions.
- Validate changes with relevant automated checks and, where appropriate, manual verification. Report what was tested, what remains unverified, and any risks.
- Explain consequential changes clearly enough for the owner to understand and review them.

## Harness experimentation

- Identify the active phase and the current conversational authorization before taking action. If either is unclear, request clarification rather than assuming permission.
- Stop at every phase boundary. Do not advance, skip a phase, or expand authorized scope without explicit human approval.
- Approval applies only to the identified phase, decision, or increment. A new session must not infer execution permission from repository documents or prior session history.
- Developer tests and in-scope corrections are part of implementation; formal verification is separately authorized.
- Record durable approved decisions and plans in the appropriate repository documents; keep transient execution authorization in the conversation.

## This project is also an experiment in agentic software development.

- Follow the phase sequence and approval boundaries defined in `.agents/development-workflow.md` for development tasks.
- Keep product requirements separate from agent workflow instructions.
- Prefer small, independently verifiable development increments.
- Report assumptions, uncertainties, verification evidence, and deviations from approved plans.
- Do not introduce additional agents, skills, frameworks, or infrastructure without a demonstrated need.
- Treat human decisions and approved specifications as authoritative. Challenge them when justified, but do not silently override them.
