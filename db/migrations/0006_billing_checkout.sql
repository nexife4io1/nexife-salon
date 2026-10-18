CREATE TYPE "salon"."invoice_line_kind" AS ENUM('catalog', 'custom');--> statement-breakpoint
CREATE TABLE "salon"."appointment_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"service_id" uuid,
	"name" text NOT NULL,
	"price_cents" integer NOT NULL,
	"duration_minutes" integer NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointment_services_price_chk" CHECK ("salon"."appointment_services"."price_cents" >= 0),
	CONSTRAINT "appointment_services_duration_chk" CHECK ("salon"."appointment_services"."duration_minutes" > 0)
);
--> statement-breakpoint
CREATE TABLE "salon"."invoice_counters" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salon"."invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"service_id" uuid,
	"kind" "salon"."invoice_line_kind" DEFAULT 'catalog' NOT NULL,
	"name" text NOT NULL,
	"staff_name" text,
	"amount_cents" integer NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_lines_amount_chk" CHECK ("salon"."invoice_lines"."amount_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "salon"."invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"appointment_id" uuid,
	"customer_id" uuid,
	"customer_name" text,
	"receipt_number" text NOT NULL,
	"currency" text NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_total_chk" CHECK ("salon"."invoices"."total_cents" > 0 and "salon"."invoices"."total_cents" = "salon"."invoices"."subtotal_cents")
);
--> statement-breakpoint
ALTER TABLE "salon"."payments" ADD COLUMN "invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "salon"."appointment_services" ADD CONSTRAINT "appointment_services_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "salon"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."appointment_services" ADD CONSTRAINT "appointment_services_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "salon"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."appointment_services" ADD CONSTRAINT "appointment_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "salon"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."invoice_counters" ADD CONSTRAINT "invoice_counters_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "salon"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."invoice_lines" ADD CONSTRAINT "invoice_lines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "salon"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "salon"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."invoice_lines" ADD CONSTRAINT "invoice_lines_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "salon"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."invoices" ADD CONSTRAINT "invoices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "salon"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."invoices" ADD CONSTRAINT "invoices_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "salon"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."invoices" ADD CONSTRAINT "invoices_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "salon"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "salon"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointment_services_appointment_idx" ON "salon"."appointment_services" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "appointment_services_tenant_idx" ON "salon"."appointment_services" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "invoice_lines_invoice_idx" ON "salon"."invoice_lines" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_lines_tenant_idx" ON "salon"."invoice_lines" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_tenant_appointment_uq" ON "salon"."invoices" USING btree ("tenant_id","appointment_id") WHERE "salon"."invoices"."appointment_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_tenant_receipt_uq" ON "salon"."invoices" USING btree ("tenant_id","receipt_number");--> statement-breakpoint
CREATE INDEX "invoices_tenant_paid_idx" ON "salon"."invoices" USING btree ("tenant_id","paid_at");--> statement-breakpoint
CREATE INDEX "invoices_customer_idx" ON "salon"."invoices" USING btree ("customer_id");--> statement-breakpoint
ALTER TABLE "salon"."payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "salon"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_invoice_idx" ON "salon"."payments" USING btree ("invoice_id");
--> statement-breakpoint
-- Existing appointments keep their single service as one snapshot line (price/duration as of this migration).
INSERT INTO "salon"."appointment_services" ("tenant_id", "appointment_id", "service_id", "name", "price_cents", "duration_minutes", "position")
SELECT a."tenant_id", a."id", s."id", s."name", s."price_cents", s."duration_minutes", 0
FROM "salon"."appointments" a
JOIN "salon"."services" s ON s."id" = a."service_id";--> statement-breakpoint

-- Tenant isolation for the new tables, same policy as 0001_rls.sql.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['appointment_services', 'invoices', 'invoice_lines', 'invoice_counters'] LOOP
    EXECUTE format('ALTER TABLE salon.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON salon.%I USING (tenant_id = salon.current_tenant_id()) WITH CHECK (tenant_id = salon.current_tenant_id())',
      t
    );
  END LOOP;
END $$;
