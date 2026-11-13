---
name: capability-contract
description: Read, extract, review or change an approved capability's local behavioural contract; trace requirements to tests. Use for capability-specification tasks and for development tasks involving a contracted capability. The project development workflow always controls authorization.
---

# Capability contracts

A capability contract specifies **observable, approved behaviour** owned by one business capability. It never describes the implementation or licenses an agent to implement. The existing `.agents/development-workflow.md` phase and approval gates take precedence over this skill and over external SBCE guidance.

## Locate and interpret
1. Find the owning business module from project vocabulary and existing architecture. For a contracted module, inspect its package documentation before proposing behavioural changes.
2. Read the applicable product specification, architecture decisions and current contract. A contract is authoritative only for explicitly covered behaviour. Product intent and approved architecture constrain it. Uncontracted behaviour retains its existing authority.
3. If sources conflict, report the specific discrepancy and stop at the applicable approval boundary. Never silently change requirements to match code or passing tests.

## Author or update (only in an authorized phase)
- Describe one coherent capability with boundary operations, EARS-style requirements, invariants, out-of-scope behaviour, and provenance to existing approved requirements.
- Use stable capability-local identifiers such as `WSD-R1.1`. Do not reuse retired IDs or renumber on reordering.
- State observable successful and unsuccessful outcomes; avoid HTTP, JVM, framework or persistence mechanics unless externally contracted.
- Keep the contract close to its owning module. For the Writing pilot use `backend/src/main/java/workbench/writing/package-info.java` with Java 25 Markdown documentation comments.
- Do not duplicate complete product decisions or create a new module merely for documentation.
- A proposed behaviour change is not approved by writing a contract. Follow the existing Requirements and Architecture gates.

## Trace and review
- Map each behavioural ID to named existing backend or frontend tests and relevant assertions; explicitly mark gaps.
- A literal requirement ID in a test label or comment only proves **discoverability**, not correct coverage.
- Use existing Kotest, Vitest, Playwright, Modulith and ArchUnit checks. The existing build is the technical oracle; independent formal verification still requires its own approval.
- Check that no contracted behaviour or accepted decision was lost, that no unrelated module changed, and that the agent did not grant itself authorization.

## Boundary
This skill does not own the product specification, testing framework, dependency choices, application architecture, phase progression, implementation permission, or formal acceptance.
