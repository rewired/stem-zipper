# ADR 0007: Continuous integration workflow

- Status: Accepted
- Date: 2025-10-22

## Context

The repository has grown to include a production-ready Electron shell, localisation catalogue and audio processing services backed by pnpm-managed dependencies. Contributors currently run linting, type checking and tests locally, but there is no shared automation enforcing these gates when code is pushed or opened as a pull request. Without a repeatable workflow, regressions may pass review unnoticed, dependency installs repeat work across runs, and the team lacks a canonical Node runtime definition for the project.

## Decision

We created a GitHub Actions workflow that runs on pushes and pull requests targeting the primary `main` and `develop` branches. The workflow provisions Node.js 18 via `actions/setup-node@v4`, installs pnpm 10.19.0 (the version declared by the application package), configures the pnpm store under `~/.pnpm-store` and caches it based on the `app/pnpm-lock.yaml` hash. With the toolchain in place, the job installs dependencies inside `app/` and executes the existing `pnpm lint`, `pnpm typecheck` and `pnpm test` quality gates to guard merges.

## Consequences

- Every change heading to the main development branches now executes the same linting, type-checking and test suite the maintainers rely on locally, reducing the risk of regressions.
- Pinning Node.js and pnpm in automation mirrors the documented environment and avoids surprise engine upgrades in CI.
- Caching the pnpm store avoids repeated dependency downloads across workflow runs, improving turnaround times for contributors and follow-up commits.
- Future jobs can extend the same workflow or re-use the environment bootstrapping steps to introduce packaging or deployment automation without duplicating setup logic.
