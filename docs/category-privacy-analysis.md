# Category Privacy & Isolation Analysis

**Question:** As a user, they can add custom categories for their needs, but these categories cannot be seen by other users or other workspaces. Why?

---

## Understanding the Problem

The issue is that currently, the business spec defines:

```typescript
// Income categories (SHARED across all users)
type IncomeCategory = "gaji" | "freelance" | "bisnis" | "investasi" | "hadiah" | "lainnya";

// Expense categories (SHARED across all users)
type ExpenseCategory = "makanan" | "transportasi" | "belanja" | "hiburan" | "tagihan" | "kesehatan" | "pendidikan" | "tabungan" | "lainnya";
```

This means:
- All users see the SAME category list
- No per-user customization
- No per-workspace customization
- Categories are globally defined by developers

---

## The "WDYT?" Question

This is the **fundamental question about data ownership**:

| Option | Description | Pros | Cons |
|--------|-------------|------|
| **Global Categories** | Simple, easy to implement | ❌ No user control, ❌ Doesn't scale to individual needs, ❌ "Why can't I add my own category?" |
| **User-Created Categories** | Full personalization, better UX | ✅ Users get what they need, ✅ Scale to preferences, ⚠️ More complex data model, ⚠️ Categories diverge across users |
| **Workspace-Created Categories** | Team control, aligned goals | ✅ Shared vocab for team, ✅ Budgeting easier, ⚠️ More complex (need user_id FK), ⚠️ Users must know categories are workspace-specific |

---

## What This Decision Impacts

### 1. Transaction Categorization
- **Budgeting**: "Makanan" means something very different if another user creates a custom "Makan" for their own definition
- **Analytics**: Income/expense breakdowns by category become meaningless if categories are global
- **User Experience**: "I want to track my side business expenses separately" - not possible with shared categories

### 2. Feature Flexibility
- **Custom Budgets**: Users can't create "Office Supplies" category for their small business
- **Team Workflows**: Teams can't agree on standard categories for their shared projects
- **Cross-Workspace Analytics**: You can't compare spending patterns if everyone uses different categories

### 3. Data Model Complexity

**Global Categories:**
```typescript
// Table: category
// Columns: id, name, type
// Rows: ~16 total rows
```

**Workspace-Created Categories:**
```typescript
// Table: category
// Columns: id, name, type, workspace_id
// Rows: Potentially 16 rows × N workspaces
// Complexity: O(N²)
```

---

## Recommended Approach: Hierarchical Categories

Instead of a single enum, use a **hierarchical category system**:

```typescript
interface Category {
  id: string;
  name: string;
  type: "income" | "expense";
  workspaceId?: string;  // Optional: for workspace-created categories
  parentId?: string;  // For subcategories
  userId?: string;  // For user-created categories (owner only)
  isSystem: boolean;  // true = predefined, false = user-created
}
```

### How It Would Work

**User Creates Category:**
```
CREATE TABLE dompetin_category (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  workspace_id UUID NULL,    -- System category (isSystem = true)
  user_id UUID NOT NULL,       -- Owner-created
  parent_id UUID NULL,        -- NULL ( root-level category
  is_system BOOLEAN DEFAULT true
);
```

**Budgeting with Hierarchical Categories:**
- Each workspace can define its own category tree
- Budgets are scoped to `category.workspace_id IS NULL` (global) OR `category.workspace_id = ?` (workspace-specific)
- Users can create subcategories: "Makanan" → "Makanan: Makan Siang", "Makanan: Bensin"
- Analytics can aggregate: "All Makanan spending" vs "Makanan: Makan Siang"

---

## Questions for Backend Team

1. **Scope Decision**: Do we want **global categories** (simple) or **hierarchical categories** (complex but flexible)?

2. **If Hierarchical**:
   - Should user-created categories be visible only to their creator/owner?
   - Or should they be workspace-shared (all members can use)?
   - How do we handle category visibility in transaction lists?

3. **Data Migration**: If switching to hierarchical, what happens to existing transactions using global category IDs?

4. **Analytics Complexity**: Can we still provide "Spending by Category" reports if categories are workspace-specific?

5. **User Experience**: Should we support category search/filtering in the UI? How do users discover their custom categories?

---

## My Recommendation as Frontend Lead

**Option A: Start Simple (Global Categories)**
- **Why:** Get to real tRPC data faster
- **Trade-off:** Accept the limitation for MVP velocity
- **Implementation:** Use the existing enum approach
- **Mitigation:** Add a "Custom / Lainnya" category that allows free-text input in transactions

**Option B: Plan for Hierarchical Categories (Future)**
- **Why:** Better UX and analytics
- **Trade-off:** More complex backend and UI, higher development time
- **Implementation:** Phase 2 feature (not MVP)
- **Timeline:** After budget module is stable

---

## Current Reality Check

Looking at the current UI implementation:
- CategoryPicker currently shows 2-column grid of enum options
- No input field for custom categories
- User can only select from predefined list

**This aligns with the business spec as written today.**

---

## Next Step: Get Backend Decision

I need to know from the Backend Team:

1. **Which approach?** Global categories (simple, fast) OR Hierarchical categories (complex, flexible)?

2. **What are the implications?**
   - Development timeline impact
   - Analytics capabilities
   - Data migration strategy if we switch later

Please respond with your decision so I can update the design docs and plan accordingly.

