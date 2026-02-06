# Changelog

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
