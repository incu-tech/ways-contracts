# ways-contracts — the canonical `ways.dev` contract catalog

The shared answer to two questions every [`ways`](https://github.com/incu-tech/ways) way has to
answer about a capability it needs:

- **What is this capability?** → a `SlotContract`: a named, versioned list of operations, decoupled
  from any tool.
- **How is a given implementation installed and verified?** → a `Binding`: the CLIs, environment
  variables and MCP servers `ways doctor` checks for one `{contract, impl}` pair.

A way declares *what it needs* (`sast`); a consumer decides *what satisfies it* (`snyk`). This
catalog is where both halves live so nobody re-authors them per way.

```yaml
# in a way.yaml — `ways.dev` is the CLI's built-in default, so this block is usually unnecessary
spec:
  contracts:
    ways.dev: { source: github:incu-tech/ways-contracts, version: ^1.0.0 }
  needs:
    - { id: sast, contract: ways.dev/sast@1 }
```

```bash
ways contracts          # what resolved, from where, and which impls can satisfy each contract
```

## What is here

| Contract | Operations | Implementations |
|---|---|---|
| `ways.dev/sast@1` | scan-code, read-findings, ignore-finding | `snyk`, `sonarqube`, `semgrep`\* |
| `ways.dev/sca@1` | scan-dependencies, read-advisories, suggest-upgrade | `snyk`, `npm-audit`, `trivy`\*, `osv-scanner`\* |
| `ways.dev/code-quality@1` | analyze-code, read-issues, read-quality-gate | `sonarqube` |
| `ways.dev/vcs-host@1` | read-repo, open-pr, pin-ref | `github`, `gitlab` |
| `ways.dev/issue-tracker@1` | create-issue, link-issue, read-issue | `linear`, `github-issues` |
| `ways.dev/error-monitoring@1` | read-issues, read-event, resolve | `sentry` |

\* covers a subset of its contract's operations — `ways doctor` reports the gap rather than pretending
otherwise. Partial coverage is a legitimate, useful state; **silently claiming full coverage is not.**

It starts deliberately small: a contract nobody references is speculation, and a binding for a tool
nobody here has run is a guess about someone else's machine. Adding to it is the point — see below.

## Layout is convention, resolution is by content

`contracts/` and `bindings/` are where readers expect things, but `ways` loads **every** artifact it
finds and keys them by declared identity:

- a contract by `metadata.name` + its **major** version → `ways.dev/sast@1`;
- a binding by the **pair** `{ spec.contract, spec.impl }`.

So moving files never breaks resolution, and one tool satisfying several contracts is one Binding file
per contract (`snyk-sast.yaml`, `snyk-sca.yaml`) rather than one file trying to be both.

## Versioning

- **The catalog is tagged** (`v1.0.0`, `v1.1.0`, …) and consumers pin a range — the built-in default
  is `^1.0.0`. Untagged `main` is not what a consumer resolves.
- **A contract's major is part of its identity.** Adding an operation to `ways.dev/sast@1` is a
  breaking change for every binding that claimed full coverage, so it is **not** a minor bump: a new
  operation means `ways.dev/sast@2` in a new file, with `@1` left intact until consumers migrate.
- Adding a contract, adding a binding, or widening an existing binding's coverage is a **minor** bump.
- Fixing a wrong `check`, `install` hint or description is a **patch**.

## Adding a binding

The common contribution: your tool satisfies a contract that already exists.

1. Copy the closest `bindings/*.yaml` to `bindings/<impl>-<contract-name>.yaml`.
2. Set `spec.contract` to the exact ref, `spec.impl` to the name consumers will type in
   `ways bind <way> <slot> <impl>`.
3. List **only** the operations your tool genuinely covers in `coversOperations`. An honest subset is
   more useful than an optimistic full set — the whole point is that `doctor` can tell a consumer what
   they are not getting.
4. Fill `requires` with what must be present for it to work: `cli` (with a `check` and an `install`
   hint), `env` (mark credentials `secret: true` — never inline a value), `mcp`.
5. `npm test` — schema validation plus the catalog-level audit.

### Two rules about `check`, because it is executed

`ways doctor` **runs** `requires.cli[].check` on a consumer's machine. Therefore:

- **It must be a bare command, no shell.** The CLI parses it against an allowlist and refuses anything
  with `;` `|` `&` `>` `<` `$` backticks, parentheses or braces. A rejected check silently never runs —
  validation that only looks like validation. `npm run audit` fails the build on one.
- **It must be read-only and fast.** `snyk --version`, `gh auth status` — a presence/config probe, not
  work. It runs on every `ways doctor`, often in CI, on machines you will never see.

`install` is only ever *shown* to a human, never executed.

## Adding a contract

Only when a way actually needs a capability nothing here describes. Name the **capability**, never the
tool (`sast`, not `snyk-scanning`). Operations are verbs a consumer can reason about, and in
`ways/v1alpha1` they are **advisory/semantic** — nothing dispatches on them yet, so their job today is
to make coverage checkable and to tell a human what the slot is for. Ship at least one binding with it,
or the contract is a slot nothing can fill.

## Trust

A catalog is **executable surface**: its bindings contribute the `check` commands `doctor` runs. `ways`
treats it accordingly — a resolved catalog is pinned (`ref`/`sha`) and digested in the consumer's
`ways.lock`, disclosed in the `ways add` approval plan, and re-approved whenever its digest changes.
Read-only commands (`doctor`, `bind`, `contracts`) never fetch it. Review binding PRs with that in
mind: you are proposing a command that will run on other people's machines.

## License

MIT © Incu
