# Product Customizer & Modifiers — Test Report

## 1. Module Overview
The Product Customizer module enables customers and staff to configure complex item variations, portion sizes, preparation choices, toppings, and add-ons with dynamic price adjustments and selection constraints (`minSelection`, `maxSelection`, `isRequired`).

## 2. Scope
- Bottom-sheet customizer drawer on mobile / modal dialog on desktop (`ProductCustomizer.tsx`).
- Single-choice modifier groups (Radio buttons, e.g., "Size: Regular / Large").
- Multi-choice modifier groups (Checkboxes, e.g., "Extra Add-ons").
- Selection validation rules (`isRequired`, `minSelection`, `maxSelection`).
- Dynamic total price calculation: $\text{Item Total} = (\text{Base Price} + \sum \text{Selected Modifier Deltas}) \times \text{Quantity}$.
- Serialization of selected modifier payloads (`groupId`, `groupName`, `optionId`, `optionName`, `priceDelta`) in `OrderItem.selectedModifiers`.

## 3. Roles Covered
- **Customer**: Configures items while adding to cart on the digital menu.
- **Waiter (`waiter`)**: Configures items when taking orders via Waiter Station POS.
- **Admin (`admin`)**: Configures modifier groups and option prices in the Catalog Manager.

## 4. Test Environment / Entry Points
- **Web Frontend**: `ProductCustomizer.tsx`, `MenuItemCard.tsx`, `CartDrawer.tsx`.
- **Backend API**:
  - `GET /api/menu` (includes modifier groups and options)
  - `POST /api/orders` (accepts `selectedModifiers` array in `items`)
- **Data Models**: `MenuItem`, `ModifierGroup`, `ModifierOption`.

---

## 5. Test Scenarios

| Test ID | Scenario | Preconditions | Steps | Expected Result | Status |
|---|---|---|---|---|---|
| TC-CUST-001 | Single-Choice Selection | Item "Burger" (₹250) has group "Bun Type" with "Brioche (+₹30)" | Select "Brioche" | Subtotal updates to ₹280; "Add to Cart" button reflects total | Code Verified |
| TC-CUST-002 | Required Group Validation | Item has a required group with no default option selected | Attempt to click "Add to Cart" without selecting | Submission blocked; group displays validation error: "Please select an option" | Code Verified |
| TC-CUST-003 | Multi-Choice Max Limit | Group "Toppings" has `maxSelection: 3` | Select 3 toppings; attempt to check a 4th | 4th checkbox disabled or toast displayed: "Maximum 3 selections allowed" | Code Verified |
| TC-CUST-004 | Multi-Choice Min Limit | Group "Sauces" has `minSelection: 2` | Select 1 sauce; click "Add to Cart" | Submission blocked until minimum 2 options are chosen | Code Verified |
| TC-CUST-005 | Zero-Cost Modifier Selection | Option "Spice Level: Medium" has `priceDelta: 0` | Select "Medium" | Item price unchanged; option included in `selectedModifiers` payload | Code Verified |
| TC-CUST-006 | Quantity Multiplier on Modifiers | Custom item total is ₹280 | Change quantity from 1 to 3 | Subtotal updates to $280 \times 3 = \text{₹}840$ | Code Verified |
| TC-CUST-007 | Modifier Payload Storage | Customized item submitted in order | Submit order | `OrderItem.selectedModifiers` stores full array of selected modifier options in DB | Code Verified |

---

## 6. Positive Test Cases
- Clear display of addon pricing tags (`+₹30.00`).
- Accurate summation of multiple modifier deltas from different groups onto the base item price.
- Customized items rendered with full modifier breadcrumbs in the cart drawer and order confirmation screens.

## 7. Negative / Validation Test Cases
- Modifying price payload client-side rejected: Server recalculates line total based on master catalog prices.
- Violating `minSelection` or `maxSelection` constraints caught and blocked by frontend validation.

## 8. Authorization / Permission Test Cases
- Customer and staff utilize the exact same customizer validation rules.
- Modifier groups and option prices can only be edited by `admin`.

## 9. Concurrency / State Tests
- Two distinct customizations of the same base item (e.g., 1 Rare burger and 1 Well-Done burger) added to cart are preserved as separate unique line items.

## 10. Realtime / Socket Tests
- Real-time catalog update (`menu.updated`) refreshes modifier availability without page reload.

## 11. Edge Cases
- Item with multiple long-text modifier names wraps cleanly on small mobile viewport widths.

## 12. Regression Scenarios
- Verify that re-opening an existing cart item for editing populates the previously selected modifier options.

## 13. Existing Historical Test Coverage
- Verified in historical catalog and menu card test documentation.

## 14. Current Codebase Differences / Outdated Cases
- **Relational Modifier Architecture**: Modifier groups are represented as first-class relational entities (`ModifierGroup`, `ModifierOption`) rather than raw unstructured strings.
- **Price Delta Math**: Option prices represent additive adjustments (`priceDelta`) applied to the base item price.

## 15. Coverage Gaps
- Automated visual snapshot testing of modifier drawers across diverse mobile viewport widths.

## 16. Final Module Test Summary
The Product Customizer module ensures precise selection constraint validation, accurate price calculations, and structured modifier data transmission to kitchen and billing systems.
