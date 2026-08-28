-- Child records inherit their parent RLS boundary; NULL branch checks are insufficient.
-- No data, grants, or definer functions change.

drop policy if exists application_versions_scoped_read on public.application_versions;
create policy application_versions_scoped_read on public.application_versions
  for select to authenticated using (
    exists (
      select 1 from public.applications a
      where a.tenant_id = application_versions.tenant_id
        and a.id = application_versions.application_id
        and private.has_permission(a.tenant_id, 'admissions.application.read', a.branch_id)
    )
  );

drop policy if exists application_documents_scoped_read on public.application_documents;
create policy application_documents_scoped_read on public.application_documents
  for select to authenticated using (
    exists (
      select 1 from public.applications a
      where a.tenant_id = application_documents.tenant_id
        and a.id = application_documents.application_id
        and private.has_permission(a.tenant_id, 'admissions.application.read', a.branch_id)
    )
  );

drop policy if exists application_reviews_scoped_read on public.application_reviews;
create policy application_reviews_scoped_read on public.application_reviews
  for select to authenticated using (
    exists (
      select 1 from public.applications a
      where a.tenant_id = application_reviews.tenant_id
        and a.id = application_reviews.application_id
        and private.has_permission(a.tenant_id, 'admissions.application.review', a.branch_id)
    )
  );

drop policy if exists admission_assessments_scoped_read on public.admission_assessments;
create policy admission_assessments_scoped_read on public.admission_assessments
  for select to authenticated using (
    exists (
      select 1 from public.applications a
      where a.tenant_id = admission_assessments.tenant_id
        and a.id = admission_assessments.application_id
        and private.has_permission(a.tenant_id, 'admissions.application.read', a.branch_id)
    )
  );

drop policy if exists admission_decisions_scoped_read on public.admission_decisions;
create policy admission_decisions_scoped_read on public.admission_decisions
  for select to authenticated using (
    exists (
      select 1 from public.applications a
      where a.tenant_id = admission_decisions.tenant_id
        and a.id = admission_decisions.application_id
        and private.has_permission(a.tenant_id, 'admissions.application.read', a.branch_id)
    )
  );

drop policy if exists admission_offers_scoped_read on public.admission_offers;
create policy admission_offers_scoped_read on public.admission_offers
  for select to authenticated using (
    exists (
      select 1 from public.applications a
      where a.tenant_id = admission_offers.tenant_id
        and a.id = admission_offers.application_id
        and private.has_permission(a.tenant_id, 'admissions.application.read', a.branch_id)
    )
  );

drop policy if exists waitlist_entries_scoped_read on public.waitlist_entries;
create policy waitlist_entries_scoped_read on public.waitlist_entries
  for select to authenticated using (
    exists (
      select 1 from public.applications a
      where a.tenant_id = waitlist_entries.tenant_id
        and a.id = waitlist_entries.application_id
        and private.has_permission(a.tenant_id, 'admissions.application.read', a.branch_id)
    )
  );

drop policy if exists admission_conversions_scoped_read on public.admission_conversions;
create policy admission_conversions_scoped_read on public.admission_conversions
  for select to authenticated using (
    exists (
      select 1 from public.applications a
      where a.tenant_id = admission_conversions.tenant_id
        and a.id = admission_conversions.application_id
        and private.has_permission(a.tenant_id, 'admissions.application.read', a.branch_id)
    )
  );

drop policy if exists admission_followups_scoped_read on public.admission_followups;
create policy admission_followups_scoped_read on public.admission_followups
  for select to authenticated using (
    exists (
      select 1 from public.enquiries e
      where e.tenant_id = admission_followups.tenant_id
        and e.id = admission_followups.enquiry_id
        and private.has_permission(e.tenant_id, 'admissions.enquiry.read', e.branch_id)
    )
    or exists (
      select 1 from public.applications a
      where a.tenant_id = admission_followups.tenant_id
        and a.id = admission_followups.application_id
        and private.has_permission(a.tenant_id, 'admissions.enquiry.read', a.branch_id)
    )
  );
