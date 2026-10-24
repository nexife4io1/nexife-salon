CREATE TYPE "salon"."appointment_service_status" AS ENUM('pending', 'in_progress', 'completed');--> statement-breakpoint
CREATE TABLE "salon"."appointment_service_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"service_line_id" uuid NOT NULL,
	"service_name" text NOT NULL,
	"kind" text NOT NULL,
	"from_status" "salon"."appointment_service_status",
	"to_status" "salon"."appointment_service_status",
	"from_staff_id" uuid,
	"from_staff_name" text,
	"to_staff_id" uuid,
	"to_staff_name" text,
	"reason" text,
	"actor_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointment_service_events_kind_chk" CHECK ("salon"."appointment_service_events"."kind" in ('added', 'removed', 'started', 'completed', 'reassigned', 'corrected'))
);
--> statement-breakpoint
CREATE TABLE "salon"."review_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"review_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"service_line_id" uuid,
	"staff_id" uuid,
	"label" text NOT NULL,
	"rating" integer NOT NULL,
	CONSTRAINT "review_ratings_kind_chk" CHECK ("salon"."review_ratings"."kind" in ('service', 'staff')),
	CONSTRAINT "review_ratings_rating_chk" CHECK ("salon"."review_ratings"."rating" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "salon"."review_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"nonce" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salon"."reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"salon_rating" smallint NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_salon_rating_chk" CHECK ("salon"."reviews"."salon_rating" between 1 and 5),
	CONSTRAINT "reviews_comment_chk" CHECK ("salon"."reviews"."comment" is null or char_length("salon"."reviews"."comment") <= 1000)
);
--> statement-breakpoint
ALTER TABLE "salon"."appointment_services" ADD COLUMN "status" "salon"."appointment_service_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "salon"."appointment_services" ADD COLUMN "staff_id" uuid;--> statement-breakpoint
ALTER TABLE "salon"."appointment_services" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "salon"."appointment_services" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "salon"."appointment_services" ADD COLUMN "performed_by_staff_id" uuid;--> statement-breakpoint
ALTER TABLE "salon"."appointment_services" ADD COLUMN "performed_by_name" text;--> statement-breakpoint
ALTER TABLE "salon"."appointment_service_events" ADD CONSTRAINT "appointment_service_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "salon"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."appointment_service_events" ADD CONSTRAINT "appointment_service_events_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "salon"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."review_ratings" ADD CONSTRAINT "review_ratings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "salon"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."review_ratings" ADD CONSTRAINT "review_ratings_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "salon"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."review_ratings" ADD CONSTRAINT "review_ratings_service_line_id_appointment_services_id_fk" FOREIGN KEY ("service_line_id") REFERENCES "salon"."appointment_services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."review_ratings" ADD CONSTRAINT "review_ratings_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "salon"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."review_requests" ADD CONSTRAINT "review_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "salon"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."review_requests" ADD CONSTRAINT "review_requests_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "salon"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."reviews" ADD CONSTRAINT "reviews_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "salon"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."reviews" ADD CONSTRAINT "reviews_request_id_review_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "salon"."review_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."reviews" ADD CONSTRAINT "reviews_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "salon"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointment_service_events_appointment_idx" ON "salon"."appointment_service_events" USING btree ("appointment_id","created_at");--> statement-breakpoint
CREATE INDEX "appointment_service_events_tenant_idx" ON "salon"."appointment_service_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "review_ratings_review_idx" ON "salon"."review_ratings" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "review_ratings_staff_idx" ON "salon"."review_ratings" USING btree ("tenant_id","staff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "review_requests_appointment_uq" ON "salon"."review_requests" USING btree ("tenant_id","appointment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "review_requests_nonce_uq" ON "salon"."review_requests" USING btree ("nonce");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_request_uq" ON "salon"."reviews" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "reviews_tenant_idx" ON "salon"."reviews" USING btree ("tenant_id","created_at");--> statement-breakpoint
ALTER TABLE "salon"."appointment_services" ADD CONSTRAINT "appointment_services_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "salon"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."appointment_services" ADD CONSTRAINT "appointment_services_performed_by_staff_id_staff_id_fk" FOREIGN KEY ("performed_by_staff_id") REFERENCES "salon"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Backfill the new service-line state from the appointment each line belongs to, so existing data keeps its meaning:
-- lines inherit the appointment's staff member, and lines of finished / in-progress appointments carry that progress.
UPDATE salon.appointment_services l SET
  staff_id = a.staff_id,
  status = CASE a.status WHEN 'completed' THEN 'completed'::salon.appointment_service_status WHEN 'in_service' THEN 'in_progress'::salon.appointment_service_status ELSE 'pending'::salon.appointment_service_status END,
  started_at = CASE WHEN a.status IN ('in_service', 'completed') THEN a.updated_at END,
  completed_at = CASE WHEN a.status = 'completed' THEN a.updated_at END,
  performed_by_staff_id = CASE WHEN a.status = 'completed' THEN a.staff_id END,
  performed_by_name = CASE WHEN a.status = 'completed' THEN (SELECT s.name FROM salon.staff s WHERE s.id = a.staff_id) END
FROM salon.appointments a WHERE a.id = l.appointment_id;--> statement-breakpoint
-- Tenant isolation, same policy as 0001_rls.sql. The public review page resolves its tenant from a signed token
-- and then runs through withTenant like everything else.
ALTER TABLE salon.appointment_service_events ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON salon.appointment_service_events USING (tenant_id = salon.current_tenant_id()) WITH CHECK (tenant_id = salon.current_tenant_id());--> statement-breakpoint
ALTER TABLE salon.review_requests ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON salon.review_requests USING (tenant_id = salon.current_tenant_id()) WITH CHECK (tenant_id = salon.current_tenant_id());--> statement-breakpoint
ALTER TABLE salon.reviews ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON salon.reviews USING (tenant_id = salon.current_tenant_id()) WITH CHECK (tenant_id = salon.current_tenant_id());--> statement-breakpoint
ALTER TABLE salon.review_ratings ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON salon.review_ratings USING (tenant_id = salon.current_tenant_id()) WITH CHECK (tenant_id = salon.current_tenant_id());
