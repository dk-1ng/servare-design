# Design process

How this repository goes from a data contract to a spec. Each milestone ends with the maintainer's approval.

| Milestone                 | Question it answers                         | Main outputs                                              |
| ------------------------- | ------------------------------------------- | --------------------------------------------------------- |
| D0 — Foundation           | Can we build and test prototypes cheaply?   | Tooling, mock client, i18n scaffold                       |
| D1 — Discovery            | Who uses it, for what, and in which states? | Persona, tasks, state inventory, contract gaps            |
| D2 — Flows & IA           | How does the user move through it?          | Flows, popup structure decision, options/history IA       |
| D3 — Wireframes           | Where does each thing go?                   | Lo-fi layouts, chosen layout (ADR)                        |
| D4 — Visual direction     | What does it look and feel like?            | Moodboard, tokens, icon and logo, `DESIGN.md`             |
| D5 — Components           | Which reusable pieces, in which states?     | Components, `gallery.html`                                |
| D6 — Content & i18n       | What does it say, in every language?        | Strings en/pt-BR, long-text pass                          |
| D7 — Prototype            | Does the whole thing work together?         | Popup, history, scan, options pages; loadable via web-ext |
| D8 — Validation & handoff | Is it usable, accessible and specified?     | Audits, `docs/spec/`, contract-gap issues in servare      |
| D9 — Sidebar              | Does it adapt to the Firefox sidebar?       | Sidebar layout                                            |
| D10 — Merge into servare  | One repository                              | History and issues moved; this repo archived              |

## Glossary

Concepts are explained here once; issues, PRs and agents link to them.

<!-- Add entries as concepts first appear in a PR. Keep each to 2–4 sentences. -->

- **Contract-first design.** The interface is designed from the data and actions the system really provides (`references/ui-contract.md`), so nothing promised by the UI is impossible to build.
- **Progressive disclosure.** Show the essentials first and reveal advanced detail on request, so beginners are not overwhelmed and experts are not limited.
- **Persona.** A short, concrete portrait of a typical user (goals, frustrations, vocabulary, context of use) used to judge design choices: "would Marina understand this?". A proto-persona is built from known assumptions instead of research and is validated later. See `docs/discovery/persona.md`.
- **Jobs-to-be-done.** Describing what people come to do as a situation, a motivation and an outcome: "When …, I want to …, so I can …". It keeps the design focused on the result the user wants, not on features, and lets tasks be ranked and measured.

## Tools

Installed per milestone, project-scoped, after reading their `SKILL.md`.

| Resource                                                                        | License                                             | Milestone | Use                                                    |
| ------------------------------------------------------------------------------- | --------------------------------------------------- | --------- | ------------------------------------------------------ |
| `ibelick/ui-skills` (`fixing-accessibility`, `create-design-md`, `baseline-ui`) | MIT                                                 | D4–D8     | Accessibility audit, `DESIGN.md`, polish pass          |
| `kaankiziltug/logo-design-skill`                                                | MIT                                                 | D4        | Icon and logo process and tests                        |
| `Jakubantalik/transitions.dev` (free transitions, copied locally)               | Own (use allowed, no redistribution of the library) | D5        | Micro-interactions with reduced-motion guards          |
| `Nutlope/hallmark` (`audit` only)                                               | MIT                                                 | D7        | Independent visual audit                               |
| DESIGN.md format (`VoltAgent/awesome-design-md`)                                | MIT                                                 | D4        | Format reference only; brand files are not used        |
| Playwright + `@axe-core/playwright`, `web-ext`                                  | Apache-2.0 / MPL-2.0                                | D0+       | Screenshots, accessibility scans, loading as extension |
