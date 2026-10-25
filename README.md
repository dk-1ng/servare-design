# Servare Design

UI/UX design for [Servare](https://github.com/dk-1ng/servare), a Firefox and Chromium extension that detects video and audio loaded by the page and saves it locally (direct files, HLS and DASH), with all processing done inside the browser.

This repository holds the design work: research, flows, decisions, a framework-free HTML/CSS/TypeScript prototype driven by mock data, and the spec that the extension implements. It builds only on the data contract published by Servare ([`references/ui-contract.md`](references/ui-contract.md)). When the design is finished it will be merged into the main repository.

## What is here

| Path                                   | Contents                                                                     |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| [`docs/brief.md`](docs/brief.md)       | One-page product and design brief                                            |
| [`docs/process.md`](docs/process.md)   | Design process, phases and glossary                                          |
| [`docs/decisions/`](docs/decisions/)   | Architecture/design decision records (ADRs)                                  |
| `docs/discovery/`, `flows/`, `visual/` | Outputs of each phase                                                        |
| `docs/spec/`                           | Final spec: tokens, components, state catalog, strings, contract gaps        |
| [`references/`](references/)           | Pinned copies of the Servare contract and design document                    |
| `prototype/`                           | Prototype pages (popup, history, options, state gallery) and the mock client |

## Principles

- **Contract first.** The UI shows only what the contract provides. Anything missing is raised as an issue in Servare, not invented.
- **Simple by default, detail on demand.** A non-technical user should be able to save a video without knowing what HLS is.
- **Accessible.** WCAG 2.2 AA in light and dark themes, fully usable with a keyboard.
- **Ready for translation.** All strings live in `_locales/<lang>/messages.json`. Layouts leave room for longer languages and use logical CSS properties.
- **Nothing remote, no framework.** The extension's CSP allows no remote fonts, icons or scripts, and Servare has no UI framework. The prototype uses system fonts, local SVG and plain TypeScript.
- **Original.** The visual language is our own; it is not modeled on other download extensions.

## How this project is built

This project is directed by its maintainer and executed with AI coding agents (Claude Code). The workflow is versioned with the code: [`CLAUDE.md`](CLAUDE.md) holds the rules and the per-issue loop, and [`.claude/agents/`](.claude/agents/) defines the specialized agents. Every change goes through an issue, a branch, an automated review and a pull request, and is merged only after the maintainer reviews and approves it.

## Run the prototype

Requires Node 22+ (see `.nvmrc`) and pnpm.

```sh
pnpm install
pnpm dev     # serves prototype/ at http://127.0.0.1:8000, rebuilding on change
pnpm check   # lint, typecheck, build and test (also run by CI)
```

Each `prototype/src/pages/*.ts` file is bundled by esbuild into `prototype/dist/`, so `prototype/` is the folder to serve or load as an extension. The dev server listens on loopback only and the prototype loads nothing remote. There are no runtime dependencies.

## Tracking

Work is planned in [issues](https://github.com/dk-1ng/servare-design/issues), grouped by milestones `D0`–`D10` and tracked on the "Servare Design" project board.

## License

[MIT](LICENSE)
