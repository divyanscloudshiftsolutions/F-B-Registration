# Dynamic Category Filtering, Inline Subcategory Management, Safe Deletion, and Separated Product Details

---

## Issue 1: Dynamic Category and Subcategory Multi-Filter Architecture in Customer Portal

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Customer Portal Menu Navigation and Product Filtering — Dynamic subcategory and dietary classification multi-filtering architecture without hardcoded values. |
| **Problems Identified** | 1. Products assigned to a Category and Subcategory in the Admin Menu lacked dynamic subcategory filtering in the Customer Portal, forcing customers to scroll through long unorganized lists.<br>2. Previous UI included an unnecessary static "Sort" button that added visual clutter without providing dynamic filtering value.<br>3. Hardcoding subcategory names would violate multi-tenant flexibility and break custom catalog hierarchies.<br>4. Unassigned products (`subcategoryId = null`) risked being hidden or misplaced when filtering by categories. |
| **Resolution** | 1. Implemented dynamic subcategory extraction in `CustomerApp.tsx` that derives available subcategories in real-time from active products under the currently selected section and category.<br>2. Removed the static "Sort" button and replaced the filter bar with responsive multi-select chip controls for categories, subcategories, and dietary classifications (`VEG`, `NON_VEG`, `EGG`, `VEGAN`).<br>3. Kept products without subcategories accessible in the parent category's default view (`All` / general view).<br>4. Preserved existing live search query, cart persistence, and table session state across all filter transitions. |
| **Activities Completed** | 1. Developed dynamic subcategory derivation logic mapping `category.subcategories` to active menu item counts.<br>2. Integrated responsive chip button rows with horizontal scrolling (`overflow-x-auto`) for mobile and tablet viewports.<br>3. Verified multi-filter intersections (Category + Subcategory + FoodType) against live catalog items.<br>4. Confirmed search query synergy so text search operates seamlessly across filtered subcategory subsets. |
| **Files / Modules Updated** | - `web-frontend/src/pages/CustomerApp.tsx`<br>- `web-frontend/src/types/index.ts` |

---

## Issue 2: Inline Subcategory Creation and Safe Category Deletion Lifecycle

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Admin Menu Management and Schema Safety — Seamless inline subcategory creation in product drawers and non-destructive category deletion safeguards. |
| **Problems Identified** | 1. Administrators creating or editing products were blocked if a required subcategory did not already exist, forcing them to abandon the product form to navigate to Category Management.<br>2. Deleting a Category previously risked cascading deletions or foreign key constraint violations against assigned products.<br>3. Products orphaned during category removal lacked safe fallback assignment, risking catalog corruption. |
| **Resolution** | 1. Updated `MenuItem.categoryId` in `backend/prisma/schema.prisma` to be nullable (`String?`), allowing products to safely exist without a parent category.<br>2. Extended `MenuService.ts` and `routes.ts` with inline subcategory creation API (`POST /api/menu/categories/:id/subcategories`) and safe atomic category/subcategory deletion methods.<br>3. Implemented two-step safe deletion transactions: before deleting a category, all associated products have their `categoryId` and `subcategoryId` set to `null`; child subcategories and the category entity are then deleted while preserving all menu items.<br>4. Enhanced `MenuItemDrawer.tsx` with an inline "+ New Subcategory" toggle that creates the subcategory under the active category and automatically selects it for the product being edited. |
| **Activities Completed** | 1. Migrated database schema with foreign key adjustments ensuring nullable category constraints.<br>2. Added inline creation UI in `MenuItemDrawer.tsx` with instant validation and dropdown auto-selection.<br>3. Updated `CategoryManagerModal.tsx` deletion dialogues to explicitly inform admins that products will be safely unassigned rather than deleted.<br>4. Verified atomic rollback safety and confirmed zero products are removed during category deletions. |
| **Files / Modules Updated** | - `backend/prisma/schema.prisma`<br>- `backend/src/services/MenuService.ts`<br>- `backend/src/routes.ts`<br>- `web-frontend/src/components/admin/MenuItemDrawer.tsx`<br>- `web-frontend/src/components/admin/CategoryManagerModal.tsx`<br>- `web-frontend/src/services/api.ts` |

---

## Issue 3: Permission-Separated Customer and Admin Product Details View Architecture

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Web Frontend Component Architecture — Strict permission separation between the Customer Portal read-only product details view and the Admin interactive details view. |
| **Problems Identified** | 1. Product card interactions in the Customer Portal lacked an expanded view for customers to examine high-resolution photos, allergens, dietary flags, and descriptions.<br>2. Initial draft details views over-implemented features by showing administrative routing stations, internal GST tags, and edit buttons that attempted to navigate customers to `/admin/menu`.<br>3. The Admin Menu Catalog (`MenuCatalogManager.tsx`) lacked a quick-view modal for inspecting full item specifications without directly opening the full edit drawer form. |
| **Resolution** | 1. Implemented a 100% read-only Product Details View modal in `CustomerApp.tsx`, triggered by clicking the body of any `MenuItemCard`. Completely stripped out edit controls, administrative routing codes, and internal pricing modes.<br>2. Styled customer image preview with a contained foreground image (`object-fit: contain`) over a subtle blurred background fill within an aspect-square container, supporting click-to-enlarge modal inspection.<br>3. Standardized customer specification grid with strict fallbacks: displays `N/A` for missing applicable data, and `Not applicable` for non-relevant data (such as dietary type on merchandise).<br>4. Created the Admin Product Details View modal in `MenuCatalogManager.tsx`, accessible by clicking product table rows or a new `<Eye />` view action. Displays comprehensive operational specs (station, prep time, GST tax tag, tags, variants) and includes `<Edit3 />` actions in both header and footer that seamlessly launch `MenuItemDrawer`. |
| **Activities Completed** | 1. Wired `MenuItemCard.tsx` click handler to open details modal while keeping Add-to-Cart controls isolated.<br>2. Cleaned `CustomerApp.tsx` by removing `canEditProduct` state, admin specifications section, and redirect logic.<br>3. Built `MenuCatalogManager.tsx` admin modal with full dark/light system styling, action buttons, and edit drawer invocation.<br>4. Validated compilation with `tsc -b && vite build` (1,854 modules transformed, 0 type/build errors). |
| **Files / Modules Updated** | - `web-frontend/src/pages/CustomerApp.tsx`<br>- `web-frontend/src/components/customer/MenuItemCard.tsx`<br>- `web-frontend/src/components/admin/MenuCatalogManager.tsx`<br>- `web-frontend/src/types/index.ts` |

---

## Issue 4: Strict Category Dependency Enforcement for Subcategory Selection and Creation

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Admin Menu Management UI/UX & Data Integrity — Enforcing strict parent category selection before allowing subcategory selection or inline creation in product forms. |
| **Problems Identified** | 1. In the Product Add/Edit drawer, the Subcategory dropdown was accessible even before a Category was chosen, presenting an ambiguous `-- None / General --` option and risking orphaned or mismatched subcategory selections.<br>2. The "+ New Subcategory" action was displayed regardless of category selection state, leading to potential creation of subcategories without a parent entity.<br>3. When an administrator changed or cleared the selected Category, previously selected subcategories were not properly flushed, risking invalid parent-child hierarchy assignments. |
| **Resolution** | 1. Implemented strict UI disabling of the Subcategory select element in `MenuItemDrawer.tsx` when `!selectedCategoryId`, styling it with `cursor-not-allowed`, muted backgrounds (`bg-zinc-100 dark:bg-zinc-800/40`), and an explicit `-- Select Category First --` placeholder.<br>2. Added a contextual helper note underneath the select explaining that a Category must be chosen above to unlock subcategory options.<br>3. Gated the "+ New Subcategory" inline creation trigger so it only appears after a Category is selected; if the category is changed or cleared, the inline creation form is closed automatically and input states are reset.<br>4. Enhanced category synchronization effect to automatically clear `selectedSubcategoryId` if the active category is deselected or if the current subcategory does not belong to the newly selected category.<br>5. Added frontend submit validation rejecting any subcategory assignment without an active category, and strengthened backend `MenuService.updateMenuItem` to ensure `subcategoryId` is set to `null` if the category is unassigned. |
| **Activities Completed** | 1. Updated `MenuItemDrawer.tsx` with conditional disabling, reactive placeholder switching, and helper prompt.<br>2. Implemented category change listener resetting subcategory selections and inline creation form.<br>3. Added form validation barrier preventing payload submission if category is missing.<br>4. Validated backend update constraint in `MenuService.ts` and verified TypeScript compilation for both frontend and backend. |
| **Files / Modules Updated** | - `web-frontend/src/components/admin/MenuItemDrawer.tsx`<br>- `backend/src/services/MenuService.ts` |

---

## Issue 5: Database Menu Taxonomy Realignment and Seed Hierarchy Synchronization

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Menu Catalog Architecture & Database Normalization — Comprehensive analysis, restructuring, and persistent seed synchronization of menu category and subcategory assignments. |
| **Problems Identified** | 1. Database contained incomplete subcategory assignments across products; Starters had only Chicken subcategory, leaving paneer and vegetarian items unclassified or without granular grouping.<br>2. Mains lacked necessary subcategories such as Curries and Biryani, causing distinct entrees to pool together without structured customer navigation.<br>3. Redundant or empty subcategories (such as `Corn`) existed in the database without associated products.<br>4. The seed script (`backend/prisma/seed.ts`) did not mirror the clean two-tier menu taxonomy, risking catalog regressions upon future database reseeds. |
| **Resolution** | 1. Inspected all production `MenuItem` records, categories, and sections to classify every product into a logical culinary hierarchy.<br>2. Created `Curries` and `Biryani` subcategories under the `Mains` category in PostgreSQL.<br>3. Reorganized all 21 products cleanly: Starters partitioned into `Chicken Starters`, `Paneer Starters`, and `Vegetarian Starters`; Mains partitioned into `Curries` and `Biryani`; Drinks, Desserts, and Merch maintained as clean top-level categories without artificial subcategories.<br>4. Cleaned up redundant and empty `Corn` subcategory.<br>5. Updated `backend/prisma/seed.ts` with the new subcategories and mapped every seed item to its respective category and subcategory IDs. |
| **Activities Completed** | 1. Analyzed all existing products, sections, and foreign key relations.<br>2. Executed atomic database updates assigning every product to its correct category and subcategory.<br>3. Removed obsolete subcategory records.<br>4. Updated seed script and verified TypeScript compilation and catalog query responses. |
| **Files / Modules Updated** | - `backend/prisma/seed.ts` |

---

## Issue 6: Customer Portal Product Details Streamlining and Redundant Metadata UI Removal

| Attribute | Details |
| :--- | :--- |
| **Project Overview** | Customer Portal UI/UX Optimization — Streamlining the customer product details modal by removing redundant internal allergen tags and search hashtags. |
| **Problems Identified** | 1. When clicking a product card, the customer-facing details modal displayed technical "Allergens" and "Tags" badge boxes that added visual clutter to the modal grid.<br>2. Promotional tags and internal indexing keywords (e.g. `#spicy`, `#chefspecial`) were displayed as raw badge pills, detracting from clean customer-oriented presentation.<br>3. Customers require a focused view on essentials: product imagery, name, description, section, category/subcategory, dietary classification, prep time, discounts, and variants. |
| **Resolution** | 1. Removed the "Allergens" and "Tags" card containers from the customer specification grid in `web-frontend/src/pages/CustomerApp.tsx`.<br>2. Maintained the balanced 2-column mobile and 3-column tablet/desktop grid layout for remaining customer specifications (Section, Category, Subcategory, Dietary Classification, Prep Time, Offers).<br>3. Preserved full allergen and tag tracking in the Admin Product Details View and edit drawer (`MenuCatalogManager.tsx` and `MenuItemDrawer.tsx`) for kitchen compliance and operational tagging. |
| **Activities Completed** | 1. Edited `CustomerApp.tsx` removing the redundant metadata display blocks from the customer modal.<br>2. Verified responsive layout behavior on mobile, tablet, and desktop viewports to ensure clean alignment without empty grid gaps.<br>3. Validated full TypeScript build with `npx tsc --noEmit` resulting in 0 errors. |
| **Files / Modules Updated** | - `web-frontend/src/pages/CustomerApp.tsx` |
