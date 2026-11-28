---
name: batch-code-review
description: Independent read-only review of a large batch of tickets, or of a change to the engine, authorization, audit or migrations, before the pull request is opened. Use after the local checks and the in-app test pass and before pushing.
---

# Batch code review

A second, independent reading of the finished diff. It adds a reviewer who did not write
the code; it does not repeat the checks that already run. It never changes code and never
posts to a pull request.

## When to run it

- A batch of **four or more tickets** going out together.
- Any change to the **engine's authorization, audit trail or database migrations**, whatever its size.
- The user asks for it.

Skip it for a single small ticket, documentation, license or website copy. The
[quality gate](../quality-gate/SKILL.md) and the [simplicity review](../simplicity-review/SKILL.md)
already cover those.

## Where it fits

1. The change is complete and the [quality gate](../quality-gate/SKILL.md) for it has passed.
2. The user has tested the behavior in the application.
3. Run this review on the branch against its base (`origin/develop`), before the push and the pull request.
4. Present the verified findings. The user decides which to fix. Fixes are ordinary commits, and only the checks whose inputs changed run again.

## How to run it

Use the `code-review` skill at the high level on the branch diff, with these limits:

- Read-only: no `--fix` and no `--comment`. Nothing is applied and nothing is posted.
- Synthetic data only. Never paste patient data, credentials or production exports into the review.
- Ask it to concentrate on what the automated checks cannot judge:
  - logic errors and regressions, including behavior changed for existing callers;
  - reuse: new code that duplicates something that already has a home ([reuse-first](../reuse-first/SKILL.md)), judged architecturally, not by token count;
  - architecture: crate and feature boundaries, transaction and authorization boundaries ([engine-command](../engine-command/SKILL.md));
  - security: missing or client-side-only authorization, audit events outside the transaction, PHI in logs or errors, injection, secrets;
  - missing tests for the cases that matter: failure paths, authorization denials, migrations, boundary values.
- Tell it to ignore what formatters, linters, the duplication and file-length limits, `knip` and the [simplicity review](../simplicity-review/SKILL.md) already settle.

## Report

Verify every finding against the code before reporting it, and drop the ones that do not hold.
For each remaining finding give the file and line, what is wrong, a concrete failing scenario, a severity
and the smallest fix. Say what the review did not cover. Clinical rules in
[AGENTS.md](../../../AGENTS.md#domain-invariants) and the
[security, audit and logging standard](../../../docs/governance/security-audit-logging.md) outrank brevity.

A passed review is not clinical validation and does not replace the quality gate.
