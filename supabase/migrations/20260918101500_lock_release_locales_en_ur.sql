-- Lock commercial institution locale configuration to English + Urdu.
-- Arabic may remain in historical terminology rows/resources, but it is no longer
-- an institution-supported release locale or selectable primary locale.

update public.institution_profiles
set
  supported_locales = case
    when cardinality(array_remove(supported_locales, 'ar')) >= 1
      then array_remove(supported_locales, 'ar')
    else array['en','ur']::text[]
  end,
  primary_locale = case
    when primary_locale in ('en','ur') then primary_locale
    when 'ur' = any(supported_locales) then 'ur'
    else 'en'
  end
where 'ar' = any(supported_locales)
   or primary_locale = 'ar';

alter table public.institution_profiles
  alter column supported_locales set default array['en','ur']::text[];

alter table public.institution_profiles
  drop constraint if exists institution_profiles_locales_check;

alter table public.institution_profiles
  add constraint institution_profiles_locales_check
  check (
    cardinality(supported_locales) between 1 and 2
    and supported_locales <@ array['en','ur']::text[]
    and primary_locale = any(supported_locales)
  );

alter table public.institution_profiles
  drop constraint if exists institution_profiles_primary_locale_check;

alter table public.institution_profiles
  add constraint institution_profiles_primary_locale_check
  check (primary_locale = any(array['en','ur']::text[]));
