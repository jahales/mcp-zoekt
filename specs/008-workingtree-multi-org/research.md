# Research: Working Tree Indexing & Multi-Org Support

**Feature**: 008-workingtree-multi-org  
**Date**: 2026-02-18

## R1: Docker Compose Dual-Mode Deployment Strategy

**Decision**: Use Docker Compose **profiles** to support working-tree, GitHub-mirror, and dual-mode deployments.

**Rationale**: Profiles are the idiomatic Docker Compose mechanism for optional services. Services without a `profiles` key always run (the webserver). Services with `profiles: [workingtree]` or `profiles: [github]` only start when that profile is activated. Users select mode via `COMPOSE_PROFILES` env var in `.env` or `--profile` CLI flag. Both profiles can be active simultaneously for dual-mode.

**Alternatives considered**:
- **Shell-conditional entrypoints** (check env vars, `exit 0` if not configured): Containers still start, appear in `docker ps`, confuse healthchecks. Rejected for being hacky.
- **Separate compose files** (one for workingtree, one for github): Requires users to pass `-f` flags. Harder to discover. Rejected.
- **Single service with mode flag**: Would merge sync and indexer logic into one container. Violates separation of concerns. Rejected.

**Key details**:
- `zoekt-webserver`: No profiles key → always runs
- `zoekt-indexer`: `profiles: [workingtree]` → needs `WORKSPACE_ROOT`
- `zoekt-sync`: `profiles: [github]` → needs `GITHUB_ORGS` + token
- Activation: `COMPOSE_PROFILES=workingtree,github` in `.env`
- `${VAR:?msg}` syntax for required env vars gives clear error messages

---

## R2: Zoekt Filesystem Indexing Capabilities

**Decision**: Use upstream `zoekt-index` with the built-in `-ignore_dirs` flag for working-tree indexing. Do NOT fork Zoekt for `.gitignore` support in the initial release.

**Rationale**: The upstream `zoekt-index` binary already supports:
- `-ignore_dirs "node_modules,.git,dist,build,vendor,.hg,.svn"` — directory-name-based exclusion during `filepath.Walk`
- `-file_limit` — max file size (default 128KB)
- These cover the overwhelming majority of use cases without modifications

Full `.gitignore` support would require either:
1. Forking zoekt and adding a Go library (e.g., `go-git/gitignore`) to the `zoekt-index` `fileAggregator.add` function
2. Pre-filtering the directory tree with an external tool

**Alternatives considered**:
- **Use the vichitra-studio fork with `-gitignore` flag**: Introduces a maintained fork dependency. The fork's implementation has compilation issues (3 fix commits). Adds `go-git` dependency to zoekt. Too much risk for initial release. Rejected for v1.
- **Pre-filter with rsync/find**: Extra complexity, stale staging directory. Rejected.
- **Add `.sourcegraph/ignore` support**: Only works with `zoekt-git-index` (git objects), not filesystem walks. Not applicable.

**Future consideration**: `.gitignore` support could be added as a follow-up feature once the core working-tree mode is validated. The integration point in `zoekt-index` is the `fileAggregator.add` function—a 10-line change.

---

## R3: Zoekt Working-Tree File Serving

**Decision**: Use the Zoekt webserver's `-working-tree` flag from the community fork OR rely on the index-based `/print` endpoint. The initial implementation will use the **index-based approach** without forking zoekt-webserver.

**Rationale**: The upstream `zoekt-webserver` `/print` endpoint serves file content from the search index. For working-tree mode, files are re-indexed every 60 seconds, so the "staleness" window is at most one sync interval. The community fork added direct disk serving via a `WorkingTree` field on the web server, but this requires forking zoekt.

For the initial release, the simpler approach is:
1. Index the working tree with `zoekt-index`
2. Serve file content from the index via the existing `/print` endpoint
3. Accept up to 60s staleness (configurable via `INDEX_INTERVAL`)

**Alternatives considered**:
- **Fork zoekt-webserver for direct disk serving**: Delivers fresher file content but requires maintaining a Go fork. Rejected for v1 (complexity vs. value).
- **Bypass zoekt entirely for file_content**: Have the MCP server read files directly from disk. Would require the MCP server to know which repos are working-tree vs. mirrored. Adds complexity to a "thin wrapper." Rejected.

---

## R4: Multi-Org Mirroring Implementation

**Decision**: Iterate over comma-separated `GITHUB_ORGS` in the shell sync script, calling `zoekt-mirror-github` once per org. Retain backward compatibility with `GITHUB_ORG` (singular).

**Rationale**: The simplest implementation. `zoekt-mirror-github` already accepts `-org` as a single org name. A shell `for` loop over comma-separated values is trivial. The sync script already runs in a `while true` loop, so adding an inner `for ORG in $GITHUB_ORGS` loop is natural.

**Backward compatibility**: If `GITHUB_ORG` (singular) is set and `GITHUB_ORGS` (plural) is not, the script uses the singular value. If both are set, `GITHUB_ORGS` takes precedence. The Docker Compose file requires one of the two (via `${GITHUB_ORGS:-${GITHUB_ORG:?...}}`).

**Alternatives considered**:
- **Spawn separate containers per org**: Over-engineered. Each container would need its own config. Rejected.
- **Use a JSON config file**: Introduces config file management. The existing env-var approach is simpler and Compose-native. Rejected.

---

## R5: Null-Safety Fixes in MCP TypeScript Code

**Decision**: Apply safe-access patterns (optional chaining) to 4 specific locations identified from the community fork's bug fixes. Update the `FileMatch.Branches` type to `string[] | undefined` in the TypeScript types.

**Rationale**: The community fork (vichitra-studio) discovered real crashes when Zoekt returns data without branch information (working-tree indices don't have branches). The fixes are minimal, defensive, and benefit all users regardless of index source.

**Specific changes**:
1. `repoList.ts`: `repo.branches.length` → `repo.branches?.length` (guard against undefined)
2. `server.ts` (`formatSearchResults`): `match.Branches[0]` → `match.Branches?.[0]` (optional chaining)
3. `server.ts` (`file_content` tool): `branch` parameter from `.default('HEAD')` to `.optional()`
4. `server.ts` (`formatFileContent`): `branch: string` → `branch: string | undefined`
5. `client.ts` (`getFileContent`): `branch: string = 'HEAD'` → `branch?: string`, conditionally append `b` param
6. `find-references.ts` (`extractUsages`): `chunk.Ranges[0]` → `chunk.Ranges?.[0]`
7. `types.ts`: `Branches: string[]` → `Branches?: string[]` (make optional)

**Alternatives considered**: None — these are straightforward bug fixes with no design alternatives.

---

## R6: Zoekt Submodule Strategy

**Decision**: Keep using the **upstream sourcegraph/zoekt** submodule. Do NOT switch to the community fork.

**Rationale**: The upstream zoekt already includes `zoekt-index` with `-ignore_dirs`, which is sufficient for v1 working-tree support. Switching to the community fork would:
1. Create a maintenance burden (keeping fork in sync with upstream)
2. Introduce unvetted Go code (3 fix-up commits suggest instability)
3. Add `go-git` dependency to zoekt

The existing Dockerfile already clones upstream zoekt with `git clone --depth 1 https://github.com/sourcegraph/zoekt.git`. This continues to work.

**Future**: If `.gitignore` or direct-disk-serving proves essential, we can evaluate forking at that point with a proper review of the Go changes.
