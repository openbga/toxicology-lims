---
name: weekly-audit
description: Read-only periodic audit of the whole repository for duplication, unused code, needless complexity, dependency risk, authentication and permission handling, exposed secrets and sensitive data in logs. Use for the weekly audit or a requested ad-hoc one; it reports and never changes code.
---

# Weekly audit

A periodic look at the **whole project**, separate from ticket work. The per-change checks
([quality gate](../quality-gate/SKILL.md), [simplicity review](../simplicity-review/SKILL.md),
[batch code review](../batch-code-review/SKILL.md)) judge one diff; this audit finds what builds up
between diffs. It reports. It does not fix, refactor, open tickets or comment on pull requests.

## Boundaries

- Read-only. Never edit, format, commit, branch or push. Work on a snapshot of `origin/develop`
  (`git fetch`, then read with `git show`, `git grep` and a temporary export outside any working checkout).
- No heavy builds: no `cargo build`, `cargo test`, `cargo clippy`, `npm ci`, `vitest`, `tauri` or bundling.
  Those belong to CI and to ticket work, and they compete with the developer's running application.
- Never install a tool. If a command below is not available, record it as **not run** with the reason.
- Synthetic data only. Never open real patient data; if a finding touches it, describe the location, not the content.
- Reach only GitHub's read APIs and the package registries.

## Scope and method

Do not repeat what CI already runs on every change (format, lint, types, tests, the
duplication and file-length limits). Read the **latest result** of the `ci` workflow on `develop`
(`gh run list --workflow ci.yml --branch develop`) and report its state instead of rerunning it.

| Area | What to look at | Evidence |
| --- | --- | --- |
| Duplication and reuse | The same rule, SQL or label in two places; copies that drifted; code that should call an existing home ([reuse-first](../reuse-first/SKILL.md)) | `git grep` hits with file and line |
| Unused code and complexity | Dead modules, unused exports and dependencies, functions near the [complexity budgets](../../../docs/governance/coding-standards.md#complexity-budgets) | Tool output when a tool is available; otherwise targeted reading |
| Dependencies | Open Dependabot alerts (`gh api repos/<repo>/dependabot/alerts`), `npm audit --omit=dev` (runtime) and `npm audit` (including development tools), the `ignore` list in `deny.toml` against its stated revisit triggers, unmaintained or yanked crates reported by the latest `policy` job | Alert numbers, advisory IDs, versions |
| Authentication and permissions | Each state-changing command has an engine-side authorization check and an audit event in the same transaction; no UI-only gate; session and lock handling ([engine-command](../engine-command/SKILL.md), [security, audit and logging](../../../docs/governance/security-audit-logging.md)) | Commands compared with their checks |
| Secrets | Keys, tokens, passwords or connection strings in tracked files or history; ignored-file coverage; workflow secrets used only where needed | Pattern search over tracked files; location only, never the value |
| Sensitive data in logs and errors | Patient or order fields reaching diagnostic logs, error messages or exports; logging must stay PHI-free | Log and error call sites |
| Other security | Workflow permissions and unpinned actions, input handling at the instrument and interface boundaries, CSP and capability files, repository security settings (secret scanning, push protection) as far as the token can read them | Files, API responses; say when a setting could not be read |

### Duplication is a question, not a verdict

For every duplicate found, decide whether the separation is justified before judging it:
a boundary between crates, a deliberate copy for safety or independence, generated code, or a
test that must stay self-contained. Classify each as **reuse justified**, **separation justified** or
**needs a decision**, and give the reason. Never recommend an automatic removal; the owner decides.

## Report

Write `.local/quality-history/audit-<UTC date>.md`. That directory is ignored by git, as
[AGENTS.md](../../../AGENTS.md) directs for review records. For each finding give:

1. the problem;
2. the evidence (file and line, alert number or command output) and the affected files or components;
3. the impact and a risk level (high, medium or low) with the reason;
4. the recommendation;
5. whether a separate ticket is needed.

Start with a summary of the checks that ran, the checks that did not and why, and the
state of the latest CI. Findings that already have a ticket or an accepted exception are
listed once with a pointer, not reported again. A quiet week gets a short report that says so. Do not
claim compliance, certification or clinical validity; this audit is an engineering review.

The user approves each follow-up before anything changes. A follow-up becomes its own ticket or
pull request, handled through the normal workflow.
