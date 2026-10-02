-- Allow the CI staging provisioner/service-role runtime to activate an E2E tenant.
-- The trigger remains private; only service_role receives execution privilege.
grant execute on function private.tenant_transition_allowed(text, text) to service_role;
