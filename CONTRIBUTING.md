# Contributing

The project accepts design, research and implementation work. Implementation follows the [implementation plan](docs/planning/implementation-plan.md) and the standards it links. Read [AGENTS.md](AGENTS.md) and the [documentation index](docs/README.md).

OpenBGA Toxicology LIMS welcomes AI-assisted contributions alongside requirements analysis,
architecture review, code review, testing and documentation. Describe the human
decisions and review performed, the tools used, the checks actually run and the
remaining gaps. Keep agent review, human review and laboratory approval distinct;
the [engineering standards](docs/governance/engineering-standards.md#human-direction-and-review)
set their responsibilities and required evidence.

Use [GitHub issues](https://github.com/openbga/toxicology-lims/issues) for bugs, questions and proposals, and pull requests against `develop` for changes. `main` holds released versions; see [branches and releases](docs/development/releases.md). Never post patient information, real requisitions, analyzer exports or credentials; report vulnerabilities privately as described in the [security policy](SECURITY.md). Developer setup is in the [developer guide](docs/development/README.md).

Describe the problem, evidence, affected requirement or decision IDs, proposed change, and remaining uncertainties. Prefer focused changes that update the canonical document rather than creating another competing summary. Include direct primary-source links and the date checked for claims that may change. Keep examples synthetic and avoid copying restricted standards or proprietary interface manuals.

Every change that people using, installing or connecting the application can observe adds one entry file in `changelog.d/`; check it with `python3 scripts/changelog.py --check`. Do not edit or commit [CHANGELOG.md](CHANGELOG.md) or the in-app What's new list: the first is regenerated when a release is cut, the second at every build, so pull requests never conflict on them. The [changelog-entry skill](.ai/skills/changelog-entry/SKILL.md) explains when an entry is needed, how to rate and word it, and how to move hand edits of CHANGELOG.md into entries. If nothing in your pull request is observable, say so in its description; a maintainer adds the `no-changelog` label.

Before submitting a change, check local links and requirement references, distinguish research from approved decisions, and explain any conflicting evidence. A lab workflow or regulatory change should identify the qualified human role needed to review it. Ordinary wording corrections do not require a new architecture decision record.

Contributions follow the [project scope](docs/project-scope.md). Build and verification commands are in the [quality-gate skill](.ai/skills/quality-gate/SKILL.md); engineering and contribution requirements are in the [engineering standards](docs/governance/engineering-standards.md) and [coding standards](docs/governance/coding-standards.md).

The project is licensed under [AGPL-3.0-only](LICENSE)
([ADR 0021](docs/architecture/decisions/0021-agplv3-license.md)); see [NOTICE](NOTICE) for
the copyright and trademark notice. Submit original contributions under
AGPL-3.0-only and identify any material governed by
other terms so its compatibility and notice obligations can be reviewed before
inclusion. Preserve applicable third-party notices. Contributors retain their
respective rights; no copyright assignment or separate DCO/CLA process is
introduced here.

Maintainer responsibilities, a written trademark-use policy and software release commitments
remain open; see the [open-source strategy](docs/governance/open-source-strategy.md),
[development disclaimer](docs/governance/development-disclaimer.md) and
[security reporting](SECURITY.md).
