# Contributing to mcp-zoekt

Thanks for your interest in contributing! This document outlines how you can help improve mcp-zoekt.

## Development Setup

1. **Prerequisites**
   - Node.js >= 18.0.0
   - npm
   - Docker (for integration tests)

2. **Clone and install**
   ```bash
   git clone https://github.com/jahales/mcp-zoekt.git
   cd mcp-zoekt/zoekt-mcp
   npm install
   ```

3. **Build**
   ```bash
   npm run build
   ```

4. **Run tests**
   ```bash
   npm test              # Unit tests
   npm run test:all      # All tests (requires Docker)
   ```

## What We Accept

### ✅ Welcome contributions

- **Bug fixes** — Help us squash bugs
- **Usability improvements** — Making the tools easier to use
- **Documentation improvements** — Better examples, clearer explanations
- **Performance optimizations** — Faster searches, better caching
- **New Zoekt query features** — Exposing more Zoekt capabilities through MCP

### 🔍 We're selective about

- **New tools** — Should align with code search use cases
- **Breaking API changes** — Need strong justification and migration path

### ❌ We don't accept

- **Unrelated features** — Tools not related to code search
- **Vendor-specific integrations** — Keep the core vendor-neutral

## Code Style

- Use **TypeScript** with strict mode
- Use **ESM modules** (`import`/`export`, not `require`)
- Use **Zod** for input validation
- Use **async/await** for asynchronous code
- Follow existing patterns in the codebase

### Naming Conventions

- `camelCase` for variables and functions
- `PascalCase` for types and interfaces
- `SCREAMING_SNAKE_CASE` for constants
- Descriptive names over abbreviations

## Testing Guidelines

- **Unit tests** — Required for all new functionality
- **Test framework** — Use Vitest
- **Test location** — `tests/unit/` for unit tests, `tests/integration/` for integration tests
- **Coverage** — Aim for high coverage on new code

### Running Tests

```bash
npm test                    # Unit tests (watch mode)
npm run test:unit           # Unit tests (single run)
npm run test:integration    # Integration tests (requires Docker)
npm run test:all            # All tests
```

## Pull Request Process

1. **Fork** the repository
2. **Create a branch** from `main` with a descriptive name
3. **Make your changes** following the code style guidelines
4. **Add tests** for new functionality
5. **Run all tests** and ensure they pass
6. **Update documentation** if needed
7. **Submit a PR** with a clear description

### PR Checklist

- [ ] Tests added/updated
- [ ] Documentation updated (if applicable)
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] All tests pass

## Commit Messages

Use clear, descriptive commit messages:

```
feat: add symbol search pagination
fix: handle empty search results gracefully
docs: update installation instructions
test: add unit tests for cursor encoding
```

## Questions?

- Open a [GitHub Discussion](https://github.com/jahales/mcp-zoekt/discussions) for questions
- Open an [Issue](https://github.com/jahales/mcp-zoekt/issues) for bugs or feature requests

Thank you for helping make mcp-zoekt better!
