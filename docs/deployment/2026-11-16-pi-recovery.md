# Pi runtime recovery — November 16, 2026

## Incident and preservation

Production returned Cloudflare 502. The open Claude Code session reported
Docker program-file corruption and was waiting for authorization; it had not
performed the proposed repair. Independent operator checks confirmed installed
package checksum mismatches for `/usr/bin/containerd` and `/usr/bin/dockerd`,
and containerd's journal showed runtime panics. This establishes damaged
program files, not the physical cause of the damage. SD-card wear is a concern,
not a proved diagnosis.

Access was through the existing Raspberry Pi Connect remote shell for
`feed-app-host`. Direct SSH from the Mac timed out.

Before repair, stopped Docker/containerd services and created a SQLite `.backup`
of `data/backend/production.db`, including committed WAL contents. The snapshot
passed `PRAGMA integrity_check` using an immutable read. Recovery artifacts are
restricted operator files on the Pi, outside Git:

`~/apps/williamtemple-feed/backups/2026-11-16-recovery/`

- `production.db` — approximately 254 MB; SHA-256
  `8370123dc37fb9cc0f924ea2cd18dd1a7a8c52a722570d522194ce7c3a88fbd6`.
- `storage-config.tar.gz` — uploaded storage, root/backend environment files,
  Compose and Docker configuration; `gzip -t` passed.
- `SHA256SUMS`, prior image identities, package verification and repair logs.

The operator archive carries secrets. Keep it restricted; the in-app sanitized
backup is the portable disaster-recovery artifact for download to the Mac.

## Runtime repair

Reinstalled the already installed official packages, without changing versions:

- `containerd.io` — `2.2.1-1~debian.13~trixie`
- `docker-ce` — `5:29.1.5-1~debian.13~trixie`

Reinstallation exited successfully. `dpkg -V containerd.io docker-ce` then
reported no mismatches. Both systemd services became active. Started the
existing 1.8.2 backend/frontend with Compose and restarted the existing
`feed-cloudflared-wth` container. Both application containers became healthy;
the public browser reached the FEED 1.8.2 sign-in screen.

Preserved the production-only `retired-personal-tunnel` profile on the old
Cloudflare service. Only backend/frontend are deployment targets; the WTH
tunnel remains the existing separately managed container.

## 1.9.0 deployment

Fast-forwarded the Pi checkout to `v1.9.0`, commit
`c88c20ff86eb890982b7c9275ade031567727b99`. The production-only Compose
profile survived. Persisted `VERSION=1.9.0` in the root `.env`, cleared shell
overrides, and checked resolved image names before starting backend/frontend
with `--no-build --wait --wait-timeout 180`. Both containers became healthy.
The existing WTH tunnel remained running.

The pulled image digests matched independent registry inspection from the Mac:

| Image | Manifest digest |
| --- | --- |
| `williamtempletech/feed-backend:1.9.0` | `sha256:c2de53d2f12c37e8de316b5c0e322ed576ce7be0e5db5d8b4dcd0f929be752b1` |
| `williamtempletech/feed-frontend:1.9.0` | `sha256:96b6eb1be515c03dc0cddb2b44f834d6d012d8dc980858419278a62d5a10368d` |

Both images' OCI version/revision labels identify 1.9.0 and the release commit.
There are no migration changes between 1.8.2 and 1.9.0. Startup reported 37
migrations, no pending migrations, and SQLite WAL mode. Local and public
`/api/health` returned `{"status":"ok","version":"1.9.0"}`. The production
browser rendered the 1.9.0 sign-in page instead of Cloudflare 502.

Sampled live counts matched the pre-repair snapshot: 231 FoodItems, 10
Categories, 2,747 Translations and 10 Users. Both recovery-artifact SHA-256
checks passed again after deployment. Downloaded apt package cache was cleared
with `apt-get clean`; free space was approximately 2.3 GB after image pulls.
No historical backups or rollback images were deleted.

At this checkpoint, administrator sign-in is still required for the portable
backup download and authenticated browser smoke. Do not interpret the public
health/sign-in checks as completed signed-in feature validation. No application
code changed in this recovery, so no local rebuild or unit-test suite was run.
After sign-in: download Backup from Data Management, verify its manifest and
checksum off-device, open the saved shopping-list templates and Builder, and
generate a PDF without overwriting a shared template.

## Follow-up

Replace or migrate the suspect SD-card storage after securing an off-device
backup. A successful package repair does not establish hardware reliability.
No database restore or seed was needed to recover the existing application.
