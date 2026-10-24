CREATE TABLE "salon"."staff_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid,
	"staff_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"check_in_at" timestamp with time zone NOT NULL,
	"check_out_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_attendance_order_chk" CHECK ("salon"."staff_attendance"."check_out_at" is null or "salon"."staff_attendance"."check_out_at" >= "salon"."staff_attendance"."check_in_at")
);
--> statement-breakpoint
CREATE TABLE "salon"."staff_login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "salon"."staff" ADD COLUMN "registration_code" text;--> statement-breakpoint
ALTER TABLE "salon"."staff_attendance" ADD CONSTRAINT "staff_attendance_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "salon"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."staff_attendance" ADD CONSTRAINT "staff_attendance_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "salon"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."staff_attendance" ADD CONSTRAINT "staff_attendance_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "salon"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_attendance_staff_day_uq" ON "salon"."staff_attendance" USING btree ("staff_id","work_date");--> statement-breakpoint
CREATE INDEX "staff_attendance_tenant_idx" ON "salon"."staff_attendance" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "staff_login_attempts_key_idx" ON "salon"."staff_login_attempts" USING btree ("key","attempted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_registration_code_uq" ON "salon"."staff" USING btree ("tenant_id","registration_code");--> statement-breakpoint
-- Tenant isolation for attendance, same policy as 0001_rls.sql. staff_login_attempts is intentionally
-- not tenant-scoped (it is read before a tenant is known) and holds no tenant data.
ALTER TABLE salon.staff_attendance ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON salon.staff_attendance USING (tenant_id = salon.current_tenant_id()) WITH CHECK (tenant_id = salon.current_tenant_id());