# Quickstart: Pagination Logic Implementation

**Feature**: 004-pagination-logic  
**Estimated Time**: 2-3 hours

## Prerequisites

- Node.js 18+ installed
- Git checkout of `004-pagination-logic` branch
- All tests currently passing (`npm test`)

## Setup

```bash
cd c:\dev\mcps\code-search\zoekt-mcp
git checkout 004-pagination-logic
npm install
npm test  # Verify baseline (144 tests passing)
```

## Key Files to Modify

| File | Changes |
|------|---------|
| `src/pagination/cursor.ts` | Remove limit from encode/decode, simplify validate |
| `tests/unit/pagination/cursor.test.ts` | Update tests, add edge cases |

## Implementation Steps

### Step 1: Update Cursor Types (15 min)

In `src/pagination/cursor.ts`:

```typescript
// BEFORE
interface DecodedCursor {
  queryHash: string;
  offset: number;
  limit: number;  // REMOVE THIS
}

// AFTER
interface DecodedCursor {
  queryHash: string;
  offset: number;
}
```

### Step 2: Simplify encodeCursor (10 min)

```typescript
// BEFORE
export function encodeCursor(query: string, offset: number, limit: number): string

// AFTER (remove limit parameter)
export function encodeCursor(query: string, offset: number): string
```

Update payload to only include `q` and `o` fields.

### Step 3: Update decodeCursor (15 min)

- Remove limit extraction from payload
- Add backward compatibility: ignore `l` field if present in old cursors
- Return only `queryHash` and `offset`

### Step 4: Simplify validateCursor (20 min)

```typescript
// BEFORE
export function validateCursor(
  cursor: string,
  query: string,
  maxLimit: number
): CursorValidation

// AFTER (remove maxLimit parameter)
export function validateCursor(
  cursor: string,
  query: string
): CursorValidation
```

Remove limit validation logic entirely.

### Step 5: Update generateNextCursor (10 min)

Update call to `encodeCursor` to pass only 2 arguments.

### Step 6: Update Tool Handlers (20 min each)

For each file in `src/tools/`:
- `search-symbols.ts`
- `search-files.ts`
- `find-references.ts`

Update `validateCursor` calls to remove the third argument:

```typescript
// BEFORE
const validation = validateCursor(cursor, query, limit);

// AFTER
const validation = validateCursor(cursor, query);
```

### Step 7: Update Tests (45 min)

In `tests/unit/pagination/cursor.test.ts`:

1. Update existing tests for new signatures
2. Add backward compatibility tests:
   - Test that old cursors with limit field still decode
3. Add edge case tests:
   - Empty cursor string
   - Non-base64 cursor
   - Non-JSON payload
   - Missing fields
   - Negative offset
   - Zero offset (valid first page)
   - Large offset values

## Verification

```bash
# Run all tests
npm test

# Run only cursor tests
npm test -- cursor

# Check coverage
npm test -- --coverage
```

### Expected Results

- All 144+ tests pass
- New edge case tests pass (~15 new tests)
- No TypeScript errors
- Coverage ≥ 90% for cursor.ts

## Commit Message Template

```
feat(pagination): remove limit from cursor structure

- Remove limit field from DecodedCursor interface
- Simplify validateCursor to only check query hash
- Add backward compatibility for existing cursors
- Add 15 new edge case tests

Fixes: Users can now change page size between requests
without getting cursor validation errors.

Closes #004-pagination-logic
```

## Common Issues

### TypeScript Errors After Signature Change

If you see errors about wrong number of arguments, search for all usages:

```bash
grep -r "encodeCursor" src/
grep -r "validateCursor" src/
```

### Test Failures

If backward compatibility tests fail, ensure `decodeCursor` gracefully ignores the `l` field:

```typescript
// In decodeCursor
const { q, o, l } = payload;  // l is destructured but not used
return { queryHash: q, offset: o };  // Only return hash and offset
```
