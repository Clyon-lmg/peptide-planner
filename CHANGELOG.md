# PeptidePlanner – Milestone 2 Consolidated
Date: 2025-08-17

## Frontend
- **/today** (app/(app)/today/page.tsx)
  - Local-date query for today
  - Status actions write canonical values: PENDING / TAKEN / SKIPPED
  - Colored pills (green=TAKEN, red=SKIPPED, blue=PENDING)

- **/calendar** (app/(app)/calendar/page.tsx)
  - Sunday→Saturday grid, today highlighted, selected day ring
  - Day badge color: red if any SKIPPED; green if all TAKEN; blue otherwise
  - Click a day to list doses below the grid with colored pills

- **Protocols UI** (app/(app)/protocols/ProtocolItemRow.tsx)
  - Spacing fixes, Delete button aligned right, Sun→Sat custom-day chips

- **Engine** (lib/protocolEngine.ts)
  - Activating a protocol deactivates others, clears **today+future** doses for the user,
    then generates 12 months using local YYYY-MM-DD
  - Idempotent and avoids duplicate (user,peptide,date) collisions

## Database
- **Status normalization** (db/sql/patch_m2_status_normalization.sql)
  - Adds `TAKEN` to `dose_status` if missing
  - Normalizes historical `COMPLETED/DONE/SUCCESS` to `TAKEN`
  - Trigger `trg_coerce_dose_status` maps future synonyms → canonical statuses

- **Dose defaults** (db/sql/patch_m2_doses_date_default.sql)
  - Trigger `trg_set_dose_defaults` ensures `user_id`, `date` and `date_for` are populated

- **Verification** (db/sql/check_m2_presence.sql)
  - Quick script to inspect enum labels, installed triggers, and sample rows

## Notes
- RLS: ensure your policies restrict reads/writes to `auth.uid()`
- Auth: using magic link via `@supabase/auth-helpers-nextjs`
- No external date libs; all local date math to avoid UTC drift

