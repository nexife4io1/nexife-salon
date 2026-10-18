CREATE TYPE "salon"."staff_gender" AS ENUM('male', 'female', 'other', 'prefer_not_to_say');--> statement-breakpoint
CREATE TYPE "salon"."staff_job_role" AS ENUM('hair_stylist', 'beauty_therapist', 'salon_assistant', 'manager');--> statement-breakpoint
CREATE TYPE "salon"."staff_status" AS ENUM('active', 'on_leave', 'inactive');--> statement-breakpoint
CREATE TABLE "salon"."staff_breaks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"label" text,
	"start_time" time(0) NOT NULL,
	"end_time" time(0) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_breaks_order_chk" CHECK ("salon"."staff_breaks"."end_time" > "salon"."staff_breaks"."start_time")
);
--> statement-breakpoint
CREATE TABLE "salon"."staff_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salon"."staff_working_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"day_of_week" smallint NOT NULL,
	"start_time" time(0) NOT NULL,
	"end_time" time(0) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_working_hours_day_chk" CHECK ("salon"."staff_working_hours"."day_of_week" between 0 and 6),
	CONSTRAINT "staff_working_hours_order_chk" CHECK ("salon"."staff_working_hours"."end_time" > "salon"."staff_working_hours"."start_time")
);
--> statement-breakpoint
ALTER TABLE "salon"."staff" ADD COLUMN "status" "salon"."staff_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "salon"."staff" ADD COLUMN "job_role" "salon"."staff_job_role";--> statement-breakpoint
ALTER TABLE "salon"."staff" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "salon"."staff" ADD COLUMN "gender" "salon"."staff_gender";--> statement-breakpoint
ALTER TABLE "salon"."staff" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "salon"."staff" ADD COLUMN "emergency_contact_name" text;--> statement-breakpoint
ALTER TABLE "salon"."staff" ADD COLUMN "emergency_contact_phone" text;--> statement-breakpoint
ALTER TABLE "salon"."staff" ADD COLUMN "monthly_salary_cents" integer;--> statement-breakpoint
ALTER TABLE "salon"."staff" ADD COLUMN "years_experience" integer;--> statement-breakpoint
ALTER TABLE "salon"."staff" ADD COLUMN "joined_on" date;--> statement-breakpoint
ALTER TABLE "salon"."staff" ADD COLUMN "casual_leaves" integer;--> statement-breakpoint
ALTER TABLE "salon"."staff" ADD COLUMN "recruitment_source" text;--> statement-breakpoint
ALTER TABLE "salon"."staff" ADD COLUMN "weekly_off_day" smallint;--> statement-breakpoint
ALTER TABLE "salon"."staff_breaks" ADD CONSTRAINT "staff_breaks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "salon"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."staff_breaks" ADD CONSTRAINT "staff_breaks_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "salon"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."staff_services" ADD CONSTRAINT "staff_services_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "salon"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."staff_services" ADD CONSTRAINT "staff_services_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "salon"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."staff_services" ADD CONSTRAINT "staff_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "salon"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."staff_working_hours" ADD CONSTRAINT "staff_working_hours_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "salon"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."staff_working_hours" ADD CONSTRAINT "staff_working_hours_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "salon"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_breaks_staff_idx" ON "salon"."staff_breaks" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "staff_breaks_tenant_idx" ON "salon"."staff_breaks" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_services_staff_service_uq" ON "salon"."staff_services" USING btree ("staff_id","service_id");--> statement-breakpoint
CREATE INDEX "staff_services_tenant_idx" ON "salon"."staff_services" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_working_hours_staff_day_uq" ON "salon"."staff_working_hours" USING btree ("staff_id","day_of_week");--> statement-breakpoint
CREATE INDEX "staff_working_hours_tenant_idx" ON "salon"."staff_working_hours" USING btree ("tenant_id");--> statement-breakpoint
-- Existing rows: derive the new status from the legacy `active` flag before the consistency check is added.
UPDATE "salon"."staff" SET "status" = 'inactive' WHERE "active" = false;--> statement-breakpoint
ALTER TABLE "salon"."staff" ADD CONSTRAINT "staff_weekly_off_day_chk" CHECK ("salon"."staff"."weekly_off_day" between 0 and 6);--> statement-breakpoint
ALTER TABLE "salon"."staff" ADD CONSTRAINT "staff_status_active_chk" CHECK ("salon"."staff"."active" = ("salon"."staff"."status" <> 'inactive'));--> statement-breakpoint
-- Tenant isolation for the new tables, same policy as 0001_rls.sql.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['staff_services', 'staff_working_hours', 'staff_breaks'] LOOP
    EXECUTE format('ALTER TABLE salon.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON salon.%I USING (tenant_id = salon.current_tenant_id()) WITH CHECK (tenant_id = salon.current_tenant_id())',
      t
    );
  END LOOP;
END $$;
