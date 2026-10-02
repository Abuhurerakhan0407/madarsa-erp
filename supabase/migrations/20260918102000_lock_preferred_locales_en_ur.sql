-- Lock active per-record locale preferences to the commercial EN/UR release.
-- Historical localized labels/templates may still contain Arabic content, but new
-- active profile/person/enquiry/application preferences must not select Arabic.
-- Existing Arabic preferences are normalized to Urdu to preserve an RTL fallback.

update public.profiles
set preferred_locale = 'ur'
where preferred_locale = 'ar';

alter table public.profiles
  drop constraint if exists profiles_preferred_locale_check;

alter table public.profiles
  add constraint profiles_preferred_locale_check
  check (preferred_locale = any (array['en','ur']::text[]));

update public.persons
set preferred_locale = 'ur'
where preferred_locale = 'ar';

alter table public.persons
  drop constraint if exists persons_preferred_locale_check;

alter table public.persons
  add constraint persons_preferred_locale_check
  check (preferred_locale = any (array['en','ur']::text[]));

update public.enquiries
set preferred_locale = 'ur'
where preferred_locale = 'ar';

alter table public.enquiries
  drop constraint if exists enquiries_preferred_locale_check;

alter table public.enquiries
  add constraint enquiries_preferred_locale_check
  check (preferred_locale = any (array['en','ur']::text[]));

update public.applications
set preferred_locale = 'ur'
where preferred_locale = 'ar';

alter table public.applications
  drop constraint if exists applications_preferred_locale_check;

alter table public.applications
  add constraint applications_preferred_locale_check
  check (preferred_locale = any (array['en','ur']::text[]));
