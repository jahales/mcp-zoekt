# Changelog

## [2.3.0](https://github.com/jahales/mcp-zoekt/compare/mcp-zoekt-v2.2.7...mcp-zoekt-v2.3.0) (2026-07-20)


### Features

* search pagination + HTTP session routing, pagination & version fixes ([ad860fc](https://github.com/jahales/mcp-zoekt/commit/ad860fc6f96faede39a5f115d10de9da5b7029e9))


### Bug Fixes

* dedupe same-line usages + guard double-close; add HTTP/version/find_references tests ([01023f8](https://github.com/jahales/mcp-zoekt/commit/01023f82c3dc52fe86ae92f8a55c97107d340b35))

## [2.2.7](https://github.com/jahales/mcp-zoekt/compare/mcp-zoekt-v2.2.6...mcp-zoekt-v2.2.7) (2026-07-20)


### Bug Fixes

* **client:** request ChunkMatches so symbol search returns results ([#35](https://github.com/jahales/mcp-zoekt/issues/35)) ([dc17dc6](https://github.com/jahales/mcp-zoekt/commit/dc17dc664fea25e22d93f04656d62f433bcc33f5))

## [2.2.6](https://github.com/jahales/mcp-zoekt/compare/mcp-zoekt-v2.2.5...mcp-zoekt-v2.2.6) (2026-02-19)


### Bug Fixes

* **zoekt-mcp:** clarify quick start logging step ([#33](https://github.com/jahales/mcp-zoekt/issues/33)) ([aba4852](https://github.com/jahales/mcp-zoekt/commit/aba4852439144106ba9a003daf860ab65017b7ed))

## [2.2.5](https://github.com/jahales/mcp-zoekt/compare/mcp-zoekt-v2.2.4...mcp-zoekt-v2.2.5) (2026-02-18)


### Bug Fixes

* **ci:** force OIDC-only npm publish ([4f7af2e](https://github.com/jahales/mcp-zoekt/commit/4f7af2e0495fceb25da8d113c0c46edbb3f57db4))

## [2.2.4](https://github.com/jahales/mcp-zoekt/compare/mcp-zoekt-v2.2.3...mcp-zoekt-v2.2.4) (2026-02-18)


### Bug Fixes

* **zoekt-mcp:** correct README license ([#28](https://github.com/jahales/mcp-zoekt/issues/28)) ([2f8287e](https://github.com/jahales/mcp-zoekt/commit/2f8287e10f11e2b655fe991eff0ecad2a813302e))

## [2.2.3](https://github.com/jahales/mcp-zoekt/compare/mcp-zoekt-v2.2.2...mcp-zoekt-v2.2.3) (2026-02-18)


### Bug Fixes

* **zoekt-mcp:** remove GitHub Packages npmrc override ([#25](https://github.com/jahales/mcp-zoekt/issues/25)) ([b6beb73](https://github.com/jahales/mcp-zoekt/commit/b6beb734188fb5c3cf1615104276baab52be7fbf))

## [2.2.2](https://github.com/jahales/mcp-zoekt/compare/mcp-zoekt-v2.2.1...mcp-zoekt-v2.2.2) (2026-02-18)


### Bug Fixes

* **zoekt-mcp:** publish to npmjs by default ([#22](https://github.com/jahales/mcp-zoekt/issues/22)) ([ca0d0c9](https://github.com/jahales/mcp-zoekt/commit/ca0d0c9224a94ddfa8ceb39b56e14203c28a9a98))

## [2.2.1](https://github.com/jahales/mcp-zoekt/compare/mcp-zoekt-v2.2.0...mcp-zoekt-v2.2.1) (2026-02-18)


### Bug Fixes

* **zoekt-mcp:** correct docker compose quickstart commands ([#20](https://github.com/jahales/mcp-zoekt/issues/20)) ([e958552](https://github.com/jahales/mcp-zoekt/commit/e9585524cdccf70cc32ecbdeaa7948cbc4f4aff9))

## [2.2.0](https://github.com/jahales/mcp-zoekt/compare/mcp-zoekt-v2.1.0...mcp-zoekt-v2.2.0) (2026-02-18)


### Features

* workingtree indexing + multi-org ([#15](https://github.com/jahales/mcp-zoekt/issues/15)) ([ac818a0](https://github.com/jahales/mcp-zoekt/commit/ac818a01fccb0b356fa18dabe31a73eeafaae977))

## [2.1.0](https://github.com/jahales/mcp-zoekt/compare/mcp-zoekt-v2.0.1...mcp-zoekt-v2.1.0) (2026-02-13)


### Features

* **docker:** continuous mirror/index sync in docker-compose ([#12](https://github.com/jahales/mcp-zoekt/issues/12)) ([35c9756](https://github.com/jahales/mcp-zoekt/commit/35c9756883d0e0ee716d1079051062b76e6e10ec))

## [2.0.1](https://github.com/jahales/mcp-zoekt/compare/mcp-zoekt-v2.0.0...mcp-zoekt-v2.0.1) (2026-02-06)


### Bug Fixes

* skip prepare script during Docker build npm ci ([#9](https://github.com/jahales/mcp-zoekt/issues/9)) ([3b3f56f](https://github.com/jahales/mcp-zoekt/commit/3b3f56fcd1352b4b8ec43d0185b2c781bd7d728c))

## [2.0.0](https://github.com/jahales/mcp-zoekt/compare/mcp-zoekt-v1.0.0...mcp-zoekt-v2.0.0) (2026-02-06)


### ⚠ BREAKING CHANGES

* Package renamed from mcp-zoekt to @jahales/mcp-zoekt for GitHub Packages registry.

### Features

* add ARM64/Apple Silicon support for Docker builds ([4d54895](https://github.com/jahales/mcp-zoekt/commit/4d54895eba96d837338a1c7c5987017799e97195))
* Add Zoekt search tools to MCP ([fb5f3af](https://github.com/jahales/mcp-zoekt/commit/fb5f3af1753875db0d85bc8b7efa5dac9055bc9d))
* **pagination:** remove limit from cursor structure ([f98d7f3](https://github.com/jahales/mcp-zoekt/commit/f98d7f379d4b843bb5661b18e8ca4bbeacf0dbbd))
* **pagination:** remove limit from cursor structure ([#4](https://github.com/jahales/mcp-zoekt/issues/4)) ([57c5a77](https://github.com/jahales/mcp-zoekt/commit/57c5a77293e7cf843547f2c83e3b319c4402149d))


### Bug Fixes

* migrate listRepos/getStats from /api/search to /api/list ([#6](https://github.com/jahales/mcp-zoekt/issues/6)) ([760da5d](https://github.com/jahales/mcp-zoekt/commit/760da5db2ac37df6f6a11ce55a9a08e4dee6a8c3))
* revert to QEMU emulation for ARM64 builds ([a093e6d](https://github.com/jahales/mcp-zoekt/commit/a093e6d865ce8388122c4ae08c06c1e66df3f980))


### Continuous Integration

* add release-please with conventional commits and GitHub Packages publishing ([#7](https://github.com/jahales/mcp-zoekt/issues/7)) ([3db3604](https://github.com/jahales/mcp-zoekt/commit/3db36041ac7abd40312b38ea030bc9df8b7ed730))
