# HubbleWave Platform - Canon Violation Fix Task

## COMPLETION SIGNALS
- Output `<promise>CANON_CLEANUP_COMPLETE</promise>` when all violations are fixed

---

# 🔒 CANON COMPLIANCE - CRITICAL FIXES

You are a **Canon-Bound Production Engineer** fixing terminology violations in the HubbleWave codebase.

## BANNED TERMS - MUST BE REPLACED

| Banned Term | Correct Term | Reason |
|-------------|--------------|--------|
| `table` | `collection` | Canon Rule 6: Schema Before Data - we use collections, not tables |
| `field` | `property` | Canon Rule 4: Metadata Is the Product - we use properties, not fields |
| `workflow` | `flow` or `process` | Canon Rule 8: Automation ≠ Workflow - use precise terminology |

**Exception:** Database layer code that directly interacts with PostgreSQL may use `table` when referring to actual database tables (e.g., in migrations, raw SQL). But application/domain layer must use `collection`.

---

# TASK 1: Fix `libs` Module (Highest Priority)

```bash
# Find all violations in libs
echo "=== LIBS MODULE VIOLATIONS ==="
grep -rn "table" --include="*.ts" --include="*.tsx" libs/ | grep -v "node_modules" | grep -v ".spec.ts" | head -50
grep -rn "field" --include="*.ts" --include="*.tsx" libs/ | grep -v "node_modules" | grep -v ".spec.ts" | head -50
grep -rn "workflow" --include="*.ts" --include="*.tsx" libs/ | grep -v "node_modules" | grep -v ".spec.ts" | head -50
```

## Fix Strategy for `libs`:
1. **Interfaces/Types**: Replace `tableId` → `collectionId`, `fieldName` → `propertyName`
2. **Variables**: Replace `table` → `collection`, `field` → `property`
3. **Comments**: Update terminology in comments
4. **Function names**: `getTableSchema` → `getCollectionSchema`, `createField` → `createProperty`

**After each file fix:**
```bash
npm run build
npm run lint
```

---

# TASK 2: Fix `svc-data` Module (High Priority)

```bash
# Find all violations in svc-data
echo "=== SVC-DATA MODULE VIOLATIONS ==="
grep -rn "table" --include="*.ts" apps/svc-data/ | grep -v "node_modules" | head -50
grep -rn "field" --include="*.ts" apps/svc-data/ | grep -v "node_modules" | head -50
grep -rn "workflow" --include="*.ts" apps/svc-data/ | grep -v "node_modules" | head -50
```

## Fix Strategy for `svc-data`:
1. **Repository layer**: May keep `table` for actual DB operations
2. **Service layer**: Must use `collection` and `property`
3. **API layer**: Must use `collection` and `property`
4. **DTOs**: `CreateFieldDto` → `CreatePropertyDto`

---

# TASK 3: Fix Other Backend Services

```bash
# Check other services
for svc in svc-identity svc-metadata svc-ava; do
  echo "=== $svc ==="
  grep -rn "table\|field\|workflow" --include="*.ts" apps/$svc/ | grep -v "node_modules" | wc -l
done
```

Fix each service following the same pattern.

---

# TASK 4: Fix Frontend Modules (web-client)

```bash
# Find violations in web-client
echo "=== WEB-CLIENT VIOLATIONS ==="
grep -rn "table" --include="*.ts" --include="*.tsx" apps/web-client/ | grep -v "node_modules" | head -50
grep -rn "field" --include="*.ts" --include="*.tsx" apps/web-client/ | grep -v "node_modules" | head -50
grep -rn "workflow" --include="*.ts" --include="*.tsx" apps/web-client/ | grep -v "node_modules" | head -50
```

## Fix Strategy for Frontend:
1. **Components**: `TableView` → `ListView` or `CollectionView`
2. **Props**: `tableData` → `collectionData`, `fields` → `properties`
3. **State**: `selectedField` → `selectedProperty`
4. **API calls**: Update to use correct endpoints

---

# TASK 5: Remove Commented-Out Code

```bash
# Find commented-out code blocks in frontend
echo "=== COMMENTED CODE IN FRONTEND ==="
grep -rn "^\s*//.*{" --include="*.ts" --include="*.tsx" apps/web-client/ | head -30
grep -rn "^\s*/\*" --include="*.ts" --include="*.tsx" apps/web-client/ | head -30
```

## Rules for Commented Code:
- **DELETE** any commented-out code blocks
- **DELETE** any `// old implementation` style comments
- **KEEP** explanatory comments that describe WHY (not WHAT)
- **KEEP** JSDoc comments
- **KEEP** eslint-disable comments (if necessary)

---

# VALIDATION CYCLE (Run After Each Module)

```bash
echo "═══════════════════════════════════════════════════════════"
echo "VALIDATION CYCLE"
echo "═══════════════════════════════════════════════════════════"

# 1. Build
npm run build
BUILD_EXIT=$?

# 2. Lint
npm run lint
LINT_EXIT=$?

# 3. Count remaining violations
echo "=== REMAINING VIOLATIONS ==="
TABLE_COUNT=$(grep -rn "table" --include="*.ts" --include="*.tsx" libs/ apps/ | grep -v "node_modules" | grep -v "migration" | grep -v ".spec.ts" | wc -l)
FIELD_COUNT=$(grep -rn "field" --include="*.ts" --include="*.tsx" libs/ apps/ | grep -v "node_modules" | grep -v ".spec.ts" | wc -l)
WORKFLOW_COUNT=$(grep -rn "workflow" --include="*.ts" --include="*.tsx" libs/ apps/ | grep -v "node_modules" | grep -v ".spec.ts" | wc -l)

echo "table: $TABLE_COUNT"
echo "field: $FIELD_COUNT" 
echo "workflow: $WORKFLOW_COUNT"

# 4. Summary
if [ $BUILD_EXIT -eq 0 ] && [ $LINT_EXIT -eq 0 ]; then
  echo "✅ Build and lint passed"
else
  echo "❌ Fix errors before continuing"
fi
echo "═══════════════════════════════════════════════════════════"
```

---

# EXECUTION ORDER

1. **Start with `libs`** - shared code affects everything
2. **Then `svc-data`** - core data service
3. **Then other backend services** - one at a time
4. **Then `web-client`** - frontend last
5. **Finally remove commented code**

## After EACH file change:
1. Save the file
2. Run `npm run build` to check for errors
3. Fix any type errors caused by renames
4. Update imports if interface/type names changed
5. Continue to next file

---

# COMPLETION CRITERIA

All of these must be true:
- [ ] `npm run build` passes with zero errors
- [ ] `npm run lint` passes
- [ ] `grep -rn "table"` returns only database layer references
- [ ] `grep -rn "field"` returns minimal/zero results (except in UI form libraries)
- [ ] `grep -rn "workflow"` returns zero results in domain code
- [ ] No commented-out code blocks remain

**When ALL criteria met:**
```
<promise>CANON_CLEANUP_COMPLETE</promise>
```

---

# IMPORTANT NOTES

1. **Preserve functionality** - this is a rename refactor, not a rewrite
2. **Update tests** - if renaming breaks tests, update the tests too
3. **Update imports** - when renaming exports, update all imports
4. **Batch by file** - fix all violations in one file before moving to next
5. **Commit frequently** - commit after each module is clean

```bash
# Commit after each module
git add -A
git commit -m "fix(canon): replace banned terms in [module-name]"
```
