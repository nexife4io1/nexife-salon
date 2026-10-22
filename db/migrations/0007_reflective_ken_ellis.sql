CREATE TABLE "salon"."staff_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"shift_id" uuid,
	"work_date" date NOT NULL,
	"shift_start" time(0) NOT NULL,
	"shift_end" time(0) NOT NULL,
	"clock_in" time(0) NOT NULL,
	"clock_out" time(0),
	"note" text,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_attendance_shift_order_chk" CHECK ("salon"."staff_attendance"."shift_end" > "salon"."staff_attendance"."shift_start"),
	CONSTRAINT "staff_attendance_clock_order_chk" CHECK ("salon"."staff_attendance"."clock_out" is null or "salon"."staff_attendance"."clock_out" >= "salon"."staff_attendance"."clock_in")
);
--> statement-breakpoint
CREATE TABLE "salon"."staff_leaves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"reason" text,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_leaves_date_order_chk" CHECK ("salon"."staff_leaves"."to_date" >= "salon"."staff_leaves"."from_date")
);
--> statement-breakpoint
DROP INDEX "salon"."staff_working_hours_staff_day_uq";--> statement-breakpoint
ALTER TABLE "salon"."staff_attendance" ADD CONSTRAINT "staff_attendance_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "salon"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."staff_attendance" ADD CONSTRAINT "staff_attendance_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "salon"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."staff_attendance" ADD CONSTRAINT "staff_attendance_shift_id_staff_working_hours_id_fk" FOREIGN KEY ("shift_id") REFERENCES "salon"."staff_working_hours"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."staff_attendance" ADD CONSTRAINT "staff_attendance_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "salon"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."staff_leaves" ADD CONSTRAINT "staff_leaves_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "salon"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."staff_leaves" ADD CONSTRAINT "staff_leaves_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "salon"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."staff_leaves" ADD CONSTRAINT "staff_leaves_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "salon"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_attendance_tenant_staff_date_start_uq" ON "salon"."staff_attendance" USING btree ("tenant_id","staff_id","work_date","shift_start");--> statement-breakpoint
CREATE INDEX "staff_attendance_tenant_date_idx" ON "salon"."staff_attendance" USING btree ("tenant_id","work_date");--> statement-breakpoint
CREATE INDEX "staff_leaves_tenant_staff_range_idx" ON "salon"."staff_leaves" USING btree ("tenant_id","staff_id","from_date","to_date");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_working_hours_staff_day_start_uq" ON "salon"."staff_working_hours" USING btree ("tenant_id","staff_id","day_of_week","start_time");
--> statement-breakpoint
-- Legacy profile-level leave had no end date. Normalize it to active so dated leave records
-- in attendance become the only source of leave status.
UPDATE "salon"."staff" SET "status" = 'active' WHERE "status" = 'on_leave';
--> statement-breakpoint
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['staff_attendance', 'staff_leaves'] LOOP
    EXECUTE format('ALTER TABLE salon.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON salon.%I USING (tenant_id = salon.current_tenant_id()) WITH CHECK (tenant_id = salon.current_tenant_id())',
      t
    );
  END LOOP;
END $$;