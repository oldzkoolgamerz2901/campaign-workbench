---
name: grilling
description: Interview the owner about consequential unresolved decisions within an authorized phase; use for deliberate stress-testing of plans or designs.
---

Interview the user to resolve consequential decisions within the currently authorized phase and agreed decision domain. The repository's development workflow governs phase boundaries; interviewing never authorizes advancing to another phase. Map this as a **design tree**: every decision branches into the decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you haven't heard yet. Ask only the consequential, currently relevant frontier questions in manageable rounds; number each question and give your recommended answer. Do not expand into unrelated branches or exhaust a decision tree beyond the authorized scope. Then wait for the user's answers before the next round.

Format a round like so:

```
❓ **Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>

---

❓ **Q2** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>
```

Word each question so "yes" accepts your recommended answer.

Each round the user answers reshapes the tree: settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round. A question whose answer depends on another question still open in this round belongs to a _later_ round, not this one.

Finding _facts_ is your job, never the user's. Use available investigation tools; delegate to a sub-agent only when available and authorized, otherwise investigate directly. When a frontier question needs a fact from the environment (filesystem, tools, etc.), investigate it; don't ask the user for anything you could look up yourself. If an investigation is still running, defer dependent questions and continue with independent decisions. The _decisions_ are the user's: put each to them and wait.

The session is done when all consequential decisions in the agreed scope are resolved or explicitly identified as outstanding. Summarize decisions, assumptions and open questions; seek the owner's approval of the phase deliverable and stop. Persist decisions only when authorized by the active phase and repository workflow.
