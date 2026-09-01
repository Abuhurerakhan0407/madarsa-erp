-- Remove exact duplicate non-unique indexes reported by the Supabase database advisor.
-- Keep the clearer query-oriented index names and remove only their redundant twins.

DROP INDEX IF EXISTS public.marksheets_subject_state_idx;
DROP INDEX IF EXISTS public.recitation_attempts_student_idx;
DROP INDEX IF EXISTS public.recitation_sessions_branch_idx;
DROP INDEX IF EXISTS public.revision_obligations_student_idx;
