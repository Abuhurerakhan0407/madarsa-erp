# Targeted Postgres index advisory audit — 2026-09-01

## Decision

The Supabase performance advisor currently reports many informational `unindexed_foreign_keys` and `unused_index` findings. This audit does **not** treat either class as an automatic migration instruction.

Production evidence supports four additive indexes in operational modules and **zero index drops**.

## Production evidence reviewed

- `pg_stat_user_tables` and `pg_stat_user_indexes` for live table/index activity.
- Current index definitions from `pg_index` / `pg_get_indexdef`.
- `pg_stat_statements` samples for operational query paths.
- Live PostgreSQL function definitions for Transport, Hostel/Mess, Library and Exams/Results.
- Supabase performance-advisor findings.

The current dataset is still small in many operational tables. Advisor entries on 0–2-row tables were therefore not converted into speculative indexes unless a real workspace query has a clear high-cardinality growth path.

## Indexes approved by evidence

### 1. `transport_assignments_stop_state_idx`

Columns: `(tenant_id, stop_id, state, ends_on)`

`get_transport_center_v1` calculates assigned counts for every stop with predicates on tenant, stop, active/planned state and end date. The existing assignment indexes are route-leading and active-student-leading, so they do not cover this per-stop aggregation. With thousands of student assignments and multiple stops, the unindexed path would repeatedly scan assignments.

### 2. `mess_attendance_service_idx`

Columns: `(tenant_id, meal_service_id)`

`get_hostel_mess_center_v1` aggregates `served_count` for each meal service and reads meal attendance by service. Mess attendance is a naturally high-growth table because it can accumulate residents × meals × days. The existing unique idempotency index does not cover service aggregation.

### 3. `library_copies_title_branch_state_idx`

Columns: `(tenant_id, title_id, branch_id, state)`

`get_library_center_v1` left-joins copies to every title by tenant/title and calculates total/available copy counts. The existing accession-number and ID indexes do not cover title aggregation. Library copy count can reasonably grow into the thousands.

### 4. `library_copies_branch_state_idx`

Columns: `(tenant_id, branch_id, state, accession_number)`

The Library workspace lists copies for one branch, excludes withdrawn records and orders by accession number. The title-leading index cannot efficiently serve a branch-only copy listing, so this separate tenant/branch-leading index is justified.

## Findings intentionally not changed

### Exams / Results

Advisor findings on `mark_entries`, `result_snapshots`, `result_subject_snapshots` and `exam_subjects` were reviewed against live function definitions. The primary runtime joins are already served by composite/unique indexes such as:

- mark entry `(tenant_id, marksheet_id, assessment_component_id, enrollment_id)`;
- result snapshot `(tenant_id, result_run_id, enrollment_id, revision)`;
- result snapshot student lookup `(tenant_id, student_person_id, state, created_at desc)`;
- result-subject `(tenant_id, result_snapshot_id)`;
- exam-subject `(tenant_id, exam_series_id)`.

Standalone indexes for the remaining FK suffixes would mainly accelerate rare parent-delete checks, while increasing write cost on mark/result generation. No change is justified yet.

### Attendance-device bridge

The advisor reports several missing FK indexes, but production contains only a tiny amount of device data and real physical device traffic is not yet proven. The existing inbox and device-event idempotency indexes serve the current operational path. Revisit after real hardware traffic exists.

### HR, Hostel event history and other low-cardinality modules

Current row counts and query evidence do not justify speculative indexes beyond the four above. Hostel allocation events are written but not currently read by the workspace. HR datasets are small and existing branch/state indexes are actively used.

### Deferred finance/accounting/payroll tables

No index changes are made to deferred Fees/Accounting, donations/fund accounting or payroll functionality as part of this operational audit.

## Unused-index findings

No index is dropped merely because `idx_scan = 0`. Many indexes are new, constraint-backed, protective for future scale, or have not received enough production traffic to prove redundancy. Exact duplicate indexes were already handled separately. A future removal requires constraint checks plus sustained usage evidence.

## Validation required before merge

- lint
- typecheck
- Vitest/contracts
- production build
- Desktop Chromium + Android Pixel 7 Playwright
- apply the exact forward migration to production Supabase only after the source contract passes
- verify the four index definitions live
- rerun the performance advisor and confirm the targeted FK findings are improved where applicable
- exact-head Vercel preview READY
- no unresolved review threads

This performance audit does not change any launch-readiness boolean.
