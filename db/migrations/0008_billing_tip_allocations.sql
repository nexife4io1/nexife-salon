CREATE TABLE "salon"."invoice_tips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"staff_id" uuid,
	"staff_name" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_tips_amount_chk" CHECK ("salon"."invoice_tips"."amount_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "salon"."invoices" DROP CONSTRAINT "invoices_tip_staff_chk";--> statement-breakpoint
ALTER TABLE "salon"."invoice_tips" ADD CONSTRAINT "invoice_tips_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "salon"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."invoice_tips" ADD CONSTRAINT "invoice_tips_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "salon"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."invoice_tips" ADD CONSTRAINT "invoice_tips_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "salon"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_tips_invoice_idx" ON "salon"."invoice_tips" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_tips_tenant_idx" ON "salon"."invoice_tips" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "invoice_tips_staff_idx" ON "salon"."invoice_tips" USING btree ("staff_id");--> statement-breakpoint

-- Carry single tips recorded by 0007 over into the per-staff breakdown. The legacy columns stay for history.
INSERT INTO "salon"."invoice_tips" ("tenant_id", "invoice_id", "staff_id", "staff_name", "amount_cents", "position")
SELECT "tenant_id", "id", "tip_staff_id", "tip_staff_name", "tip_cents", 0
FROM "salon"."invoices"
WHERE "tip_cents" > 0 AND "tip_staff_name" IS NOT NULL;--> statement-breakpoint

-- Tenant isolation for the new table, same policy as 0001_rls.sql.
ALTER TABLE "salon"."invoice_tips" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON "salon"."invoice_tips" USING (tenant_id = salon.current_tenant_id()) WITH CHECK (tenant_id = salon.current_tenant_id());
