# Contributing to Servare Design

This repository follows the conventions of [Servare](https://github.com/dk-1ng/servare/blob/main/CONTRIBUTING.md). The rules below are the ones specific to design work.

## Originality (mandatory)

- The visual language, icons and copy must be original. Do not reproduce or closely imitate the interface of other download extensions or of any brand.
- Third-party assets (icons, CSS snippets, fonts) are allowed only under an MIT-compatible license, copied into the repository and listed in `THIRD_PARTY_NOTICES.md`.
- Visual references live in `references/images/` for discussion only; they are never traced or copied.

## Constraints from the extension

- **Nothing remote:** no CDN, no remote fonts, icons or scripts. System font stack and local SVG only.
- **No UI framework:** plain HTML, CSS and TypeScript, or Web Components.
- **Contract first:** data comes only from `references/ui-contract.md`, through the mock client. Missing data becomes a contract-gap note, then an issue in Servare.
- **i18n:** no user-facing string in HTML or TypeScript; every string has a key in `prototype/_locales/en/messages.json` and `pt_BR`.
- **Accessibility:** WCAG 2.2 AA, keyboard operable, visible focus, `prefers-reduced-motion` and `prefers-color-scheme` respected.

## Workflow

1. Every change starts from an issue with context, inputs, tasks and acceptance criteria.
2. Branch off `main`: `design/<issue>-short-description`, `feat/...`, `docs/...`, `chore/...`, `spike/...`.
3. Commits follow [Conventional Commits](https://www.conventionalcommits.org/), in English and imperative mood:
   ```
   feat(popup): add job card for paused state
   docs(discovery): add state inventory
   ```
   Common scopes: `popup`, `history`, `options`, `sidebar`, `system`, `content`, `a11y`, `mock`, `spec`, `ci`, `docs`.
4. Decisions that settle a question go to `docs/decisions/NNNN-title.md` (see the template there) and are not reopened without new evidence.
5. Open the PR with `Closes #N`, fill in the template and attach screenshots for visual changes.
6. CI must pass. The maintainer approves before merge (squash).

Everything in the repository (code, comments, docs, issues, commits, PRs) is written in English.
