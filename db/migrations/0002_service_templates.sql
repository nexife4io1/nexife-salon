CREATE TABLE "salon"."service_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"default_duration_minutes" integer DEFAULT 30 NOT NULL,
	"default_price_cents" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "salon"."services" ADD COLUMN "template_id" uuid;--> statement-breakpoint
ALTER TABLE "salon"."services" ADD CONSTRAINT "services_template_id_service_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "salon"."service_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "services_tenant_template_uq" ON "salon"."services" USING btree ("tenant_id","template_id");