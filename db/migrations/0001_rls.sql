-- Row-Level Security: tenant isolation enforced by Postgres.
--
-- How it works
--   * Repositories run tenant-scoped work through db/client.ts `withTenant()`,
--     which sets `app.tenant_id` for the transaction.
--   * Each policy below only exposes rows whose tenant_id matches that setting.
--
-- IMPORTANT (TODO step 1 — Auth + Tenants foundation):
--   Table owners bypass RLS. Migrations + seed run as the owner (fine), but the
--   running app must connect as a NON-owner role for these policies to bite:
--
--     create role salon_app login password '...';
--     grant usage on schema salon to salon_app;
--     grant select, insert, update, delete on all tables in schema salon to salon_app;
--
--   then point the app's DATABASE_URL at salon_app. Until then RLS is
--   defence-in-depth only; repositories still filter by tenant_id explicitly.
--
-- `users` and `tenants` are intentionally excluded: login must look users up
-- before a tenant is known. They are protected by the service layer instead.

CREATE OR REPLACE FUNCTION salon.current_tenant_id() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.tenant_id', true), '')::uuid $$;
--> statement-breakpoint

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'branches', 'staff', 'services', 'customers', 'appointments',
    'payments', 'finance_entries', 'inventory_items', 'stock_movements'
  ] LOOP
    EXECUTE format('ALTER TABLE salon.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON salon.%I USING (tenant_id = salon.current_tenant_id()) WITH CHECK (tenant_id = salon.current_tenant_id())',
      t
    );
  END LOOP;
END $$;
