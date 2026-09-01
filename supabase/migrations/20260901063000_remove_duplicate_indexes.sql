-- Remove exact duplicate non-unique indexes reported by the Supabase database advisor.
-- Preserve the twin currently selected by PostgreSQL where usage counters differ.

DROP INDEX IF EXISTS public.marksheets_series_subject_idx;
DROP INDEX IF EXISTS public.recitation_attempts_student_idx;
DROP INDEX IF EXISTS public.recitation_sessions_branch_idx;
DROP INDEX IF EXISTS public.revision_obligations_student_idx;
