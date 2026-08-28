# Project Development Standards

## 1. Runtime Code Separation

The `src/` directory must contain ONLY production runtime code.

- Test files belong in `tests/`
- Reusable scripts belong in `scripts/` or `tools/`
- Test and script directories are excluded from `tsconfig.json` compilation (`dist/` output)

## 2. Temporary Script Policy (Mandatory)

If any temporary `.ts` file is created for:

- Database migration, data correction, one-time data update
- Trigger creation/removal, schema fixing
- Data import/export, cleanup scripts
- Debugging, testing, verification
- One-time backend processing
- Any temporary development task

Then:

1. Create the script
2. Execute it
3. Verify the expected result
4. **Remove the script immediately** if it is no longer required

Do NOT leave temporary scripts inside the repository after their purpose has been completed.

If a script is expected to be reused in the future, place it under `scripts/` or `tools/` with proper documentation explaining its purpose. Otherwise, delete it after execution.

## 3. Repository Cleanliness

The repository must remain clean and production-ready. Do not keep:

- Temporary scripts
- Throwaway utilities
- One-time migration helpers
- Debugging files
- Experimental files
- Duplicate implementations
- Backup files
- Unused code

Every file in the repository must have a clear long-term purpose.

## 4. Before Creating Any New File

Before creating a new `.ts` file, determine:

- Is it permanent?
- Is it reusable?
- Is it only for a one-time task?

If it is only for a one-time task, automatically delete it after successful execution and verification.

## 5. Development Standard

Always prefer:

- Modifying existing services
- Extending existing modules
- Reusing existing utilities

instead of creating unnecessary new files. Only create new files when there is a valid architectural reason.

## 6. Web UI Design Rules (Mandatory)

The attached Design System image is the single source of truth for the entire Web Frontend UI/UX. Do not reinterpret the color hierarchy or introduce new primary colors.

### Color Usage & Accent Policy (Strict)
* **Primary brand palette**: Purple (Brand Primary), White, Black, Neutral Gray variants. Must be used consistently across Sidebar, Header, Buttons, Cards, Tables, Forms, Inputs, Search Bars, Filters, Modals, Profile Menu, Pagination, Empty/Loading States, Login Screen, Dashboard, Reports, and all Management Pages.
* **Dominance restriction**: Do NOT use Green, Pink, Orange, Cyan, Yellow or other accent colors as primary UI colors or dominant visual identity.
* **Limited accent colors**: Reserved ONLY for information visualization and status indication (Dashboard Charts, Status Indicators, Badges, Chips, Notification Dots, Legend Labels, Activity Indicators).

### Component-Specific Styling Rules
* **Buttons**: Primary actions must use ONLY Brand Purple styling. Secondary/Ghost buttons must remain neutral. No bright pink Logout, Delete, or Cancel buttons. Destructive confirmations may use danger treatment.
* **Cards**: Clean and minimal. White (Light Theme) or Dark Surface (Dark Theme). Reliance on typography, spacing, and icons rather than colored backgrounds.
* **Tables**: Highly readable, neutral design. Accent colors restricted to small status badges/indicators.
* **Dashboard**: Minimalist and professional executive SaaS appearance. Surround UI remains neutral.
* **Sidebar**: Active navigation item uses primary brand highlight (Purple); inactive items remain neutral. No random accent backgrounds.
* **Icons**: Monochrome design. Only the active icon may use primary brand highlight.

