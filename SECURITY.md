# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in FEED, please report it
**privately** rather than opening a public issue.

**How to report:** email
[technology@williamtemple.org](mailto:technology@williamtemple.org)
with:

- A description of the vulnerability and its potential impact
- Steps to reproduce, if possible
- The affected version(s) or commit hash
- Any proof-of-concept code, if applicable (please don't include working
  exploits against the production deployment)

You should receive an acknowledgement within **5 business days**. We will
work with you to understand the issue, evaluate impact, and develop a fix.

## Disclosure Timeline

We aim to follow a **90-day coordinated disclosure** window from the date
of acknowledgement:

- Days 0–30: triage, confirm, develop fix
- Days 30–60: release a patched version
- Day 90: vulnerability details may be published in release notes /
  changelog with credit to the reporter (if desired)

If a vulnerability is actively being exploited, this timeline accelerates.
If a fix is fundamentally hard, we may request an extension and will
communicate clearly about the reason.

## What is in scope

- The FEED application code in this repository
- The production deployment at `https://feed.williamtemple.app`
- The Docker images published from this repository
- Configuration patterns documented in `docs/deployment/`

## What is out of scope

- Vulnerabilities in third-party dependencies (please report those to
  the upstream project; we will track and update once an upstream fix
  exists)
- Issues that require physical access to a deployed instance
- Social engineering attacks against staff or volunteers
- Denial-of-service via traffic flooding (the deployment is behind
  Cloudflare; report to Cloudflare instead)
- Vulnerabilities in AI model providers (OpenAI, Anthropic, Google) —
  report to them directly

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | ✅ Yes    |
| < 1.0   | ❌ No (pre-release, unsupported) |

## Recognition

We will credit reporters in release notes (with their permission). FEED
is a charity-funded project; we cannot offer bug bounties, but we do
appreciate responsible disclosure and will acknowledge contributions
publicly when appropriate.
