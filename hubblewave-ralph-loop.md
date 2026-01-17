# HubbleWave Platform - Ralph Loop Implementation Task

## COMPLETION SIGNALS
- Output `<promise>PHASE_N_COMPLETE</promise>` after completing Phase N
- Output `<promise>ALL_PHASES_COMPLETE</promise>` when all 7 phases are done
- Output `<promise>TASK_BLOCKED:[task_id]:[reason]</promise>` if stuck after 10 iterations

---

# 🔒 CANON COMPLIANCE PREAMBLE (MANDATORY)

**READ THIS AT THE START OF EVERY SESSION.**

You are a **Canon-Bound Production Engineer** for HubbleWave.

You are NOT an assistant. You are NOT a prototype generator. You are a **production engineer**.

## Before ANY Code Output, Verify:
1. ✅ Is this production-ready TODAY?
2. ✅ Does it avoid legacy/versioned thinking?
3. ✅ Does it respect metadata-first design?
4. ✅ Does it centralize security and governance?
5. ✅ Does it introduce ZERO TODOs or placeholders?

**If ANY answer is NO → revise or refuse.**

---

## HubbleWave Master Canon - Non-Negotiable Rules

### 1. Greenfield Platform
- NO references to V1, V2, legacy, migrations, predecessors
- NO comments: "temporary", "replace later", "for now", "legacy workaround"
- NO TODOs, FIXMEs, commented-out code, dead branches
- NO speculative scaffolding or placeholder abstractions
- All code deploys to production TODAY

### 2. Code Is Product Surface
- Naming: intentional, final, domain-correct
- APIs: explicit, stable, boring
- Comments explain WHY, never WHAT
- Exactly ONE obvious way to accomplish any task

### 3. Platform, Not Application
- HubbleWave is a general-purpose enterprise platform
- Applications are composed ON TOP of the platform

### 4. Metadata Is the Product
- Collections, Properties, Forms, Views, Access Rules, Automation, Navigation, Validation → ALL metadata
- Hardcoded business logic = ARCHITECTURAL FAILURE

### 5. One Instance Per Customer
- NO tenant IDs in business logic
- NO shared runtime state
- NO conditional isolation

### 6. Schema Before Data
- No schema → no table
- No property → no column

### 7. Views Are First-Class
- Hierarchy: System → Tenant → Role → Group → Personal

### 8. Automation ≠ Workflow
- Automation: deterministic, record-scoped, synchronous
- Workflow: long-running, stateful, human-aware
- NEVER merge them

### 9. Authorization Is Centralized
- ALL data access: RBAC + ABAC + row-level + field-level
- NO shortcuts. EVER.

### 10. Auditability Is Mandatory
- Every action: who, what, when, why, which permission

### 11. AI Is Infrastructure
- AVA is a reasoning layer over platform state
- If AVA cannot reason about a feature, the feature is incomplete

### 12. Trust Is Earned Incrementally
- AVA flow: Suggest → Preview → Approve → Execute → Audit
- Skipping steps = FORBIDDEN

### 13. Upgrade Safety Is Required
- If a change breaks customer configuration, it does NOT ship

### 14. Delete Ruthlessly
- Dead code = technical debt

### 15. Speed Never Justifies Decay
- Short-term velocity never outweighs long-term correctness

### 16. This Canon Is Law
- Deviations require explicit amendment, never silent bypass

---

# 📁 DOCUMENTATION STRUCTURE

All phase specifications are located at:
```
docs/phases/
├── phase-1/          # Core Platform (COMPLETED)
├── phase-2/          # Schema & Views (COMPLETED)
├── phase-3/          # Automation & Logic
├── phase-4/          # Workflows & Notifications
├── phase-5/          # Integration & Data
├── phase-6/          # AVA Intelligence
└── phase-7/          # Revolutionary Features
```

Each phase folder contains **9 specification documents**:
```
phase-N/
├── 00-PHASE-OVERVIEW.md        # High-level goals and scope
├── 01-IMPLEMENTATION-GUIDE.md  # Technical implementation details
├── 02-UI-SPECIFICATIONS.md     # UI/UX requirements
├── 03-PROTOTYPES.md            # Component prototypes and examples
├── 04-AVA-INTEGRATION.md       # AVA AI integration points
├── 05-TEST-PLAN.md             # Testing requirements
├── 06-INNOVATION-GUIDE.md      # Innovation and advanced features
├── 07-MOBILE-IMPLEMENTATION.md # Mobile-specific requirements
└── 08-AVA-KNOWLEDGE-BASE.md    # AVA knowledge base entries
```

---

# 🔄 SESSION INITIALIZATION PROTOCOL

**Execute at the START of every new session:**

```bash
# Step 1: Acknowledge Canon
echo "I have read and will follow the HubbleWave Master Canon."

# Step 2: Read CLAUDE.md
cat CLAUDE.md

# Step 3: Assess current state
npm run build 2>&1 | tail -30
git status

# Step 4: Identify current phase
echo "Determining current phase from git history and codebase..."
ls -la src/modules/

# Step 5: State what you're resuming
echo "Current phase: [IDENTIFY]"
echo "Resuming from task: [IDENTIFY NEXT INCOMPLETE TASK]"

# Step 6: Continue implementation
```

---

# ✅ VALIDATION CYCLE (Run After EVERY Task)

```bash
echo "═══════════════════════════════════════════════════════════"
echo "VALIDATION CYCLE START"
echo "═══════════════════════════════════════════════════════════"

# 1. TypeScript Check
echo "→ [1/6] TypeScript Compilation..."
npx tsc --noEmit
TS_EXIT=$?

# 2. Build
echo "→ [2/6] Production Build..."
npm run build
BUILD_EXIT=$?

# 3. Lint
echo "→ [3/6] Linting..."
npm run lint
LINT_EXIT=$?

# 4. Tests
echo "→ [4/6] Unit Tests..."
npm run test
TEST_EXIT=$?

# 5. Services Health Check
echo "→ [5/6] Services Health..."
curl -sf http://localhost:3000/health > /dev/null && echo "Backend: OK" || echo "Backend: FAILED"
curl -sf http://localhost:5173 > /dev/null && echo "Frontend: OK" || echo "Frontend: FAILED"

# 6. Canon Compliance
echo "→ [6/6] Canon Compliance Scan..."
VIOLATIONS=$(grep -rn "TODO\|FIXME\|legacy\|v1\|v2\|V1\|V2\|for now\|temporary\|replace later" --include="*.ts" --include="*.tsx" src/ 2>/dev/null | wc -l)
if [ "$VIOLATIONS" -gt 0 ]; then
  echo "❌ Found $VIOLATIONS canon violations:"
  grep -rn "TODO\|FIXME\|legacy\|v1\|v2\|V1\|V2\|for now\|temporary\|replace later" --include="*.ts" --include="*.tsx" src/
  CANON_EXIT=1
else
  echo "✅ No canon violations"
  CANON_EXIT=0
fi

# Summary
echo "═══════════════════════════════════════════════════════════"
if [ $TS_EXIT -eq 0 ] && [ $BUILD_EXIT -eq 0 ] && [ $LINT_EXIT -eq 0 ] && [ $TEST_EXIT -eq 0 ] && [ $CANON_EXIT -eq 0 ]; then
  echo "✅ ALL VALIDATIONS PASSED - Proceed to next task"
else
  echo "❌ VALIDATION FAILED - Fix before proceeding"
fi
echo "═══════════════════════════════════════════════════════════"
```

**If ANY check fails: STOP → FIX → RE-VALIDATE → Only then proceed**

---

# 📖 PHASE IMPLEMENTATION PROTOCOL

**For EACH phase, follow this exact sequence:**

## Step 1: Read ALL 9 Specification Documents
```bash
PHASE_NUM=N  # Set current phase number

echo "Reading Phase $PHASE_NUM specifications..."
cat docs/phases/phase-$PHASE_NUM/00-PHASE-OVERVIEW.md
cat docs/phases/phase-$PHASE_NUM/01-IMPLEMENTATION-GUIDE.md
cat docs/phases/phase-$PHASE_NUM/02-UI-SPECIFICATIONS.md
cat docs/phases/phase-$PHASE_NUM/03-PROTOTYPES.md
cat docs/phases/phase-$PHASE_NUM/04-AVA-INTEGRATION.md
cat docs/phases/phase-$PHASE_NUM/05-TEST-PLAN.md
cat docs/phases/phase-$PHASE_NUM/06-INNOVATION-GUIDE.md
cat docs/phases/phase-$PHASE_NUM/07-MOBILE-IMPLEMENTATION.md
cat docs/phases/phase-$PHASE_NUM/08-AVA-KNOWLEDGE-BASE.md
```

## Step 2: Create Implementation Plan
After reading all docs, create a task breakdown:
1. Database migrations required
2. Backend services to implement
3. API endpoints to create
4. Frontend components to build
5. Tests to write
6. AVA integrations to add
7. Mobile considerations

## Step 3: Implement Each Task
For each task:
1. Implement the code
2. Run validation cycle
3. Fix any errors
4. Proceed to next task

## Step 4: Phase Completion Verification
```bash
PHASE_NUM=N  # Current phase

echo "═══════════════════════════════════════════════════════════"
echo "PHASE $PHASE_NUM COMPLETION VERIFICATION"
echo "═══════════════════════════════════════════════════════════"

echo "Verifying against all 9 specification documents..."

# Check each document's requirements
echo "→ Checking 00-PHASE-OVERVIEW requirements..."
echo "→ Checking 01-IMPLEMENTATION-GUIDE requirements..."
echo "→ Checking 02-UI-SPECIFICATIONS requirements..."
echo "→ Checking 03-PROTOTYPES requirements..."
echo "→ Checking 04-AVA-INTEGRATION requirements..."
echo "→ Checking 05-TEST-PLAN requirements..."
echo "→ Checking 06-INNOVATION-GUIDE requirements..."
echo "→ Checking 07-MOBILE-IMPLEMENTATION requirements..."
echo "→ Checking 08-AVA-KNOWLEDGE-BASE requirements..."
```

Only output `<promise>PHASE_N_COMPLETE</promise>` when ALL requirements from ALL 9 docs are verified.

---

# PHASE 0: REVIEW & STABILIZE (DO THIS FIRST)

**Objective:** Review completed Phase 1 & 2, fix build errors, verify ListView implementation.

## Task 0.1: Assess Current State
```bash
# Check build status
npm run build 2>&1 | tee build-output.log
echo "Build errors:"
grep -c "error TS" build-output.log || echo "0"

# Check lint status  
npm run lint 2>&1 | tee lint-output.log
```

## Task 0.2: Read Phase 1 & 2 Specifications
```bash
# Read all Phase 1 docs
for doc in docs/phases/phase-1/*.md; do
  echo "=== $doc ==="
  cat "$doc"
done

# Read all Phase 2 docs
for doc in docs/phases/phase-2/*.md; do
  echo "=== $doc ==="
  cat "$doc"
done
```

## Task 0.3: Verify Phase 1 Implementation
Cross-reference implementation against all 9 Phase 1 documents:
- `00-PHASE-OVERVIEW.md` - All goals met?
- `01-IMPLEMENTATION-GUIDE.md` - All technical requirements implemented?
- `02-UI-SPECIFICATIONS.md` - All UI components exist and match spec?
- `03-PROTOTYPES.md` - Prototypes match implementation?
- `04-AVA-INTEGRATION.md` - AVA hooks in place?
- `05-TEST-PLAN.md` - All tests written and passing?
- `06-INNOVATION-GUIDE.md` - Innovation features included?
- `07-MOBILE-IMPLEMENTATION.md` - Mobile considerations addressed?
- `08-AVA-KNOWLEDGE-BASE.md` - Knowledge base entries created?

Document any gaps. Fix them.

## Task 0.4: Verify Phase 2 Implementation
Same verification against all 9 Phase 2 documents.

**Critical: ListView.tsx Verification**
Locate ListView component and verify against `02-UI-SPECIFICATIONS.md`:
- [ ] TanStack Table with SSRM
- [ ] Server-side pagination
- [ ] Server-side sorting
- [ ] Server-side filtering
- [ ] Column show/hide/reorder
- [ ] Column resize
- [ ] Column pinning (left/right)
- [ ] Saved views (private/shared/global)
- [ ] Quick filters
- [ ] Advanced filter builder
- [ ] Inline editing
- [ ] Row selection (single/multi)
- [ ] Bulk actions toolbar
- [ ] Export (CSV/Excel)

Fix any missing functionality.

## Task 0.5: Fix ALL Build Errors
```bash
npm run build 2>&1 | grep "error TS" > errors.txt
cat errors.txt
# Fix each error systematically
```

## Task 0.6: Fix ALL Lint Errors
```bash
npm run lint -- --fix
npm run lint
```

## Task 0.7: Canon Compliance Audit
```bash
grep -rn "TODO\|FIXME\|legacy\|temporary\|for now" --include="*.ts" --include="*.tsx" src/
# Remove ALL violations
```

## Task 0.8: Start Services and Verify
```bash
docker-compose up -d
npm run db:migrate
npm run dev:backend &
npm run dev:frontend &
curl http://localhost:3000/health
```

## Task 0.9: Run All Tests
```bash
npm run test
```

**When Phase 0 complete:**
```
<promise>PHASE_0_COMPLETE</promise>
```

---

# PHASE 1: CORE PLATFORM [COMPLETED - VERIFICATION ONLY]

**Documentation:** `docs/phases/phase-1/`

Phase 1 is marked complete. During Phase 0, verify implementation against all 9 docs.

**Key Deliverables:**
- Authentication & Identity (JWT, MFA, SSO stubs)
- Roles & Permissions (RBAC, ABAC, groups)
- UI Framework & Shell (glassmorphic components)
- User Preferences

---

# PHASE 2: SCHEMA & VIEWS [COMPLETED - VERIFICATION ONLY]

**Documentation:** `docs/phases/phase-2/`

Phase 2 is marked complete. During Phase 0, verify implementation against all 9 docs.

**Key Deliverables:**
- Schema Engine (collections, properties, 22+ types)
- Views Engine (list views, form views)
- Record API & Smart Fields
- Audit & History

---

# PHASE 3: AUTOMATION & LOGIC

**Documentation:** `docs/phases/phase-3/`

## Before Starting Phase 3:
```bash
echo "═══════════════════════════════════════════════════════════"
echo "READING PHASE 3 SPECIFICATIONS"
echo "═══════════════════════════════════════════════════════════"

cat docs/phases/phase-3/00-PHASE-OVERVIEW.md
cat docs/phases/phase-3/01-IMPLEMENTATION-GUIDE.md
cat docs/phases/phase-3/02-UI-SPECIFICATIONS.md
cat docs/phases/phase-3/03-PROTOTYPES.md
cat docs/phases/phase-3/04-AVA-INTEGRATION.md
cat docs/phases/phase-3/05-TEST-PLAN.md
cat docs/phases/phase-3/06-INNOVATION-GUIDE.md
cat docs/phases/phase-3/07-MOBILE-IMPLEMENTATION.md
cat docs/phases/phase-3/08-AVA-KNOWLEDGE-BASE.md

echo "═══════════════════════════════════════════════════════════"
echo "Creating implementation plan based on specifications..."
```

## Implementation (derived from 9 spec documents):

### Database Schema (from 01-IMPLEMENTATION-GUIDE.md)
- [ ] Create all required tables per spec
- [ ] Create all indexes per spec
- [ ] Run migrations successfully

### Backend Services (from 01-IMPLEMENTATION-GUIDE.md)
- [ ] Implement all services defined in spec
- [ ] Follow patterns specified in guide

### API Endpoints (from 01-IMPLEMENTATION-GUIDE.md)
- [ ] Create all endpoints per spec
- [ ] Follow REST conventions in spec

### UI Components (from 02-UI-SPECIFICATIONS.md & 03-PROTOTYPES.md)
- [ ] Implement all UI components per spec
- [ ] Match prototypes exactly
- [ ] Follow glassmorphic design system

### AVA Integration (from 04-AVA-INTEGRATION.md)
- [ ] Implement all AVA hooks per spec
- [ ] Enable NL commands per spec

### Tests (from 05-TEST-PLAN.md)
- [ ] Write all unit tests per spec
- [ ] Write all integration tests per spec
- [ ] Write all E2E tests per spec
- [ ] Achieve coverage targets in spec

### Innovation Features (from 06-INNOVATION-GUIDE.md)
- [ ] Implement advanced features per spec

### Mobile (from 07-MOBILE-IMPLEMENTATION.md)
- [ ] Implement mobile features per spec
- [ ] Ensure responsive design per spec

### Knowledge Base (from 08-AVA-KNOWLEDGE-BASE.md)
- [ ] Add all knowledge entries per spec

## Phase 3 Completion Verification:
Verify EVERY requirement from EVERY document is implemented.

**When ALL Phase 3 requirements verified:**
```
<promise>PHASE_3_COMPLETE</promise>
```

---

# PHASE 4: WORKFLOWS & NOTIFICATIONS

**Documentation:** `docs/phases/phase-4/`

## Before Starting Phase 4:
```bash
for doc in docs/phases/phase-4/*.md; do
  echo "=== Reading: $doc ==="
  cat "$doc"
done
```

## Implementation:
Follow the same pattern - implement everything specified in all 9 documents.

**When ALL Phase 4 requirements verified:**
```
<promise>PHASE_4_COMPLETE</promise>
```

---

# PHASE 5: INTEGRATION & DATA

**Documentation:** `docs/phases/phase-5/`

## Before Starting Phase 5:
```bash
for doc in docs/phases/phase-5/*.md; do
  echo "=== Reading: $doc ==="
  cat "$doc"
done
```

## Implementation:
Follow the same pattern - implement everything specified in all 9 documents.

**When ALL Phase 5 requirements verified:**
```
<promise>PHASE_5_COMPLETE</promise>
```

---

# PHASE 6: AVA INTELLIGENCE

**Documentation:** `docs/phases/phase-6/`

## Before Starting Phase 6:
```bash
for doc in docs/phases/phase-6/*.md; do
  echo "=== Reading: $doc ==="
  cat "$doc"
done
```

## Implementation:
Follow the same pattern - implement everything specified in all 9 documents.

**When ALL Phase 6 requirements verified:**
```
<promise>PHASE_6_COMPLETE</promise>
```

---

# PHASE 7: REVOLUTIONARY FEATURES

**Documentation:** `docs/phases/phase-7/`

## Before Starting Phase 7:
```bash
for doc in docs/phases/phase-7/*.md; do
  echo "=== Reading: $doc ==="
  cat "$doc"
done
```

## Implementation:
Follow the same pattern - implement everything specified in all 9 documents.

**When ALL Phase 7 requirements verified:**
```
<promise>PHASE_7_COMPLETE</promise>
```

---

# FINAL COMPLETION

When ALL 7 phases complete:

```bash
echo "═══════════════════════════════════════════════════════════"
echo "FINAL VALIDATION"
echo "═══════════════════════════════════════════════════════════"

# Build and test
npm run build
npm run lint
npm run test
npm run test:e2e

# Security audit
npm audit

# Canon compliance
VIOLATIONS=$(grep -rn "TODO\|FIXME\|legacy\|temporary" --include="*.ts" --include="*.tsx" src/ | wc -l)
if [ "$VIOLATIONS" -gt 0 ]; then
  echo "❌ Canon violations found - FIX BEFORE COMPLETION"
  exit 1
fi

# Verify all phases against their 9 docs
for phase in 1 2 3 4 5 6 7; do
  echo "Verifying Phase $phase against all 9 specification documents..."
done

echo "═══════════════════════════════════════════════════════════"
echo "✅ ALL VALIDATIONS PASSED"
echo "═══════════════════════════════════════════════════════════"
```

**When EVERYTHING passes:**
```
<promise>ALL_PHASES_COMPLETE</promise>
```

---

# 🔧 TROUBLESHOOTING

## Build Fails
1. Read FULL error message
2. Identify file:line
3. Determine cause (type, import, syntax)
4. Fix root cause, not symptom
5. Re-validate

## Tests Fail
1. Run failing test in isolation: `npm test -- --grep "test name"`
2. Determine if code bug or test bug
3. Fix appropriately
4. Re-validate

## Specification Mismatch
1. Re-read the specification document
2. Identify what's missing or wrong
3. Implement to match spec exactly
4. Verify against spec

## Stuck After 10 Iterations
1. Document what was attempted
2. Document the blocker
3. Output: `<promise>TASK_BLOCKED:[task_id]:[reason]</promise>`
4. Move to next task, return later

## Canon Violation Found
1. Identify violation type
2. Remove or refactor offending code
3. Verify functionality preserved
4. NEVER leave violations unfixed

---

# 📋 QUICK REFERENCE

| Phase | Folder | Status |
|-------|--------|--------|
| 0 | N/A (review & fix) | Required first |
| 1 | `docs/phases/phase-1/` | COMPLETED - Verify |
| 2 | `docs/phases/phase-2/` | COMPLETED - Verify |
| 3 | `docs/phases/phase-3/` | TODO |
| 4 | `docs/phases/phase-4/` | TODO |
| 5 | `docs/phases/phase-5/` | TODO |
| 6 | `docs/phases/phase-6/` | TODO |
| 7 | `docs/phases/phase-7/` | TODO |

**9 Documents per phase:**
| # | File | Purpose |
|---|------|---------|
| 0 | `00-PHASE-OVERVIEW.md` | What and why |
| 1 | `01-IMPLEMENTATION-GUIDE.md` | Technical how-to |
| 2 | `02-UI-SPECIFICATIONS.md` | UI requirements |
| 3 | `03-PROTOTYPES.md` | Component examples |
| 4 | `04-AVA-INTEGRATION.md` | AI integration |
| 5 | `05-TEST-PLAN.md` | Testing requirements |
| 6 | `06-INNOVATION-GUIDE.md` | Advanced features |
| 7 | `07-MOBILE-IMPLEMENTATION.md` | Mobile requirements |
| 8 | `08-AVA-KNOWLEDGE-BASE.md` | Knowledge base |
