CREATE TYPE "salon"."service_audience" AS ENUM('unisex', 'women', 'men', 'kids');--> statement-breakpoint
CREATE TABLE "salon"."branch_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "salon"."service_templates" ADD COLUMN "audience" "salon"."service_audience" DEFAULT 'unisex' NOT NULL;--> statement-breakpoint
ALTER TABLE "salon"."services" ADD COLUMN "audience" "salon"."service_audience" DEFAULT 'unisex' NOT NULL;--> statement-breakpoint
ALTER TABLE "salon"."branch_services" ADD CONSTRAINT "branch_services_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "salon"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."branch_services" ADD CONSTRAINT "branch_services_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "salon"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."branch_services" ADD CONSTRAINT "branch_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "salon"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "branch_services_branch_service_uq" ON "salon"."branch_services" USING btree ("branch_id","service_id");--> statement-breakpoint
CREATE INDEX "branch_services_tenant_idx" ON "salon"."branch_services" USING btree ("tenant_id");--> statement-breakpoint
-- Tenant isolation for the new table, same policy as 0001_rls.sql.
ALTER TABLE "salon"."branch_services" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON "salon"."branch_services" USING (tenant_id = salon.current_tenant_id()) WITH CHECK (tenant_id = salon.current_tenant_id());
