---
name: efficient-implementation
description: Reduce rework when implementing approved changes with costly integration or browser checks.
---

Apply within the existing workflow and authorization.

- Reuse gathered context; use targeted reads for missing facts.
- For behavior changes, exercise the known failure and relevant
  lookup/use races with a focused test before expensive suites.
- Confirm edits landed before testing. Prefer focused patches;
  assert replacement matches when scripting.
- Keep tested sources unchanged throughout a run. Finish or stop
  the run before editing its inputs.
- Iterate with the smallest relevant check. Run required broad
  checks on a stable candidate; repeat when changes, failures or
  unresolved risks invalidate the evidence. Preserve separately
  required formal verification.
- Keep handovers to decisions, results and remaining risks.
  This skill requires no additional checklist or report.
