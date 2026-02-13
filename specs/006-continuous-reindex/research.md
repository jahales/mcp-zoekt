# Research: Continuous Reindex for Docker Compose

**Feature**: `006-continuous-reindex`  
**Date**: 2026-02-13

## R1: Restart Policy for Loop Containers

**Decision**: Use `restart: unless-stopped`

**Rationale**: Recovers from unexpected crashes (OOM, segfault) but does not auto-start on system reboot, which is appropriate for a local dev compose stack. On `docker compose down`, SIGTERM is sent; the shell exits cleanly and is not restarted.

**Alternatives considered**:
- `always` — also restarts on daemon restart (reboot), undesirable for dev.
- `"no"` — current value for mirror; no recovery from crashes.

## R2: Environment Variable Defaults

**Decision**: Set defaults in the `environment:` block using `${VAR:-default}` Compose interpolation syntax. Reference with `$$` escaping inside `command:` blocks so the shell reads the container env var at runtime.

**Rationale**: `${SYNC_INTERVAL:-3600}` is resolved by Compose at parse time if the host env var is unset. Inside the shell command, `$$SYNC_INTERVAL` accesses the container environment set by the `environment:` block. This is the standard pattern used throughout both existing compose files.

**Alternatives considered**:
- Hard-coded values — not configurable, rejected per FR-005.
- `.env` file only — `.env` doesn't support `:-` defaults; less explicit.

## R3: Sequential Execution Guarantee

**Decision**: Rely on POSIX shell sequential semantics (`while true; do task; sleep N; done`).

**Rationale**: POSIX shell executes each command sequentially. `sleep N` only starts after the task exits. No overlapping cycles are possible without explicit backgrounding (`&`). This satisfies FR-003 with zero additional mechanism.

**Alternatives considered**:
- Flock or lock files — unnecessary; shell is already sequential.
- External scheduler (cron inside container) — adds complexity with no benefit for dev use.

## R4: Container Architecture — Merge vs. Separate

**Decision**: Merge mirror + index into a single long-lived container.

**Rationale**:
1. The existing `update-index.sh` already runs mirror → index sequentially. A single-container loop is the in-process equivalent.
2. Eliminates the `depends_on: service_completed_successfully` problem — the original dependency assumed a one-shot mirror; with a long-lived mirror, the index container would start immediately (the mirror never "completes successfully" because it loops forever).
3. Simplest coordination model: mirror always finishes before indexing starts. No race conditions. No signaling mechanisms.
4. Both containers already use the same image (`zoekt:local`), same volumes, and same network.

**Alternatives considered**:
- Separate containers, no dependency — race condition (indexer may run on stale clones). Acceptable for dev, but confusing; rejected for simplicity.
- Shared signal file — over-engineered for local dev; requires `inotifywait` or polling.
- Two separate containers with independent intervals — breaks the invariant that index should follow mirror.

**Impact**: The `zoekt-indexserver` service is replaced by a single `zoekt-sync` (or similar) service that does both mirror + index in one loop. The `zoekt-mirror` service is removed from `docker-compose.yml`.

## R5: Timestamped Logging on Alpine/BusyBox

**Decision**: Use `date -u '+%Y-%m-%dT%H:%M:%SZ'` for ISO 8601 UTC timestamps.

**Rationale**: BusyBox `date` (used in Alpine-based `zoekt:local` image) does not support `-Iseconds` (GNU coreutils extension). The format string `'+%Y-%m-%dT%H:%M:%SZ'` with `-u` produces equivalent ISO 8601 output and is fully portable.

**Alternatives considered**:
- `date -Iseconds` — not supported in BusyBox, rejected.
- `date` (default format) — not ISO 8601, harder to parse for monitoring.

## R6: README and Documentation Updates

**Decision**: Update `docker/README.md` to reflect the merged service and new environment variables.

**Rationale**: The README already documents `INDEX_INTERVAL`. The new service introduces `SYNC_INTERVAL` (or keeps `INDEX_INTERVAL` for backward compatibility). Operations sections (Force Re-index, logs) need updating to reference the new service name.
