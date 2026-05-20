# Contributing to FEED

Thanks for considering a contribution. FEED is a working food pantry
management system built for William Temple House and shared as an
AGPL-3.0 reference implementation for other nonprofits.

## Quick links

- **Bug reports** — open an issue with the `bug` template
- **Feature requests** — open an issue with the `feature` template
- **Questions** — use the `question` issue template or start a Discussion
- **Security issues** — please do **not** open a public issue. See
  [SECURITY.md](./SECURITY.md) for the private disclosure process.

## Development environment

### Prerequisites

- Node.js 20 or 24 (Node 23 has known `fontkit` issues with the
  Phase 1 / reference PDF pipeline)
- Docker Desktop (for running the full stack locally)
- A modern terminal

### One-time setup

```bash
git clone https://github.com/MattGeiger/williamtemple-feed.git
cd williamtemple-feed
npm install --prefix packages/backend --legacy-peer-deps
npm install --prefix packages/frontend
```

`--legacy-peer-deps` is needed for the backend because of a pre-existing
peer-dependency conflict between `zod` v4 and OpenAI's optional `zod` v3
peer range. See [`AGENTS.md`](./AGENTS.md) for details.

### Running locally

```bash
# In one terminal — backend
cd packages/backend && npm run dev
# Default: http://localhost:3001

# In another terminal — frontend
cd packages/frontend && npm run dev
# Default: http://localhost:5173
```

The frontend talks to the backend via `VITE_API_BASE_URL` (defaults to
`http://localhost:3001`). The backend uses SQLite by default; the
database file is created on first run.

### Full deployment

For Docker-based deployment to a server (the way this is deployed in
production), see [`docs/deployment/DOCKER_DEPLOYMENT.md`](./docs/deployment/DOCKER_DEPLOYMENT.md).

## Project structure

This is a monorepo with two main packages:

```
packages/
  backend/    Node + Express + Prisma + SQLite
  frontend/   Vite + React + TypeScript + Tailwind
```

Project conventions, error-handling patterns, deployment notes, and the
shopping-list / AI-configuration domain context are documented in
[`AGENTS.md`](./AGENTS.md). That document is required reading before
making non-trivial changes.

## Branching and PRs

- Branch from `main`
- Keep changes focused — one feature or fix per branch
- Add or update tests where the change touches business logic
- Update `CHANGELOG.md` for user-visible changes
- Update `ISSUES.md` if the change resolves or affects a tracked issue
- Open a PR with a description of intent and verification steps (what
  you tested and how)

## Testing

```bash
cd packages/backend && npm test
cd packages/frontend && npm test
```

For Shopping List Builder changes specifically, **PDF output must be
visually verified** (not just tested for a `%PDF` response). Render the
generated PDF to PNG and compare against the canvas preview.

## License

By contributing to FEED, you agree that your contributions will be
licensed under [AGPL-3.0-or-later](./LICENSE), the same license as the
project.

If you make and deploy a modified version of FEED — including as a
hosted web service — the AGPL requires you to publish your modified
source code under the same license. See section 13 of the license for
the specific network-use clause.

## Questions

If you're not sure whether a contribution fits, open a Discussion or a
`question` issue before investing significant work. The maintainers are
happy to weigh in on direction.
