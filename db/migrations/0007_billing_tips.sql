ALTER TABLE "salon"."invoices" DROP CONSTRAINT "invoices_total_chk";--> statement-breakpoint
ALTER TABLE "salon"."invoices" ADD COLUMN "tip_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "salon"."invoices" ADD COLUMN "tip_staff_id" uuid;--> statement-breakpoint
ALTER TABLE "salon"."invoices" ADD COLUMN "tip_staff_name" text;--> statement-breakpoint
ALTER TABLE "salon"."invoices" ADD CONSTRAINT "invoices_tip_staff_id_staff_id_fk" FOREIGN KEY ("tip_staff_id") REFERENCES "salon"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salon"."invoices" ADD CONSTRAINT "invoices_tip_staff_chk" CHECK ("salon"."invoices"."tip_cents" = 0 or "salon"."invoices"."tip_staff_name" is not null);--> statement-breakpoint
ALTER TABLE "salon"."invoices" ADD CONSTRAINT "invoices_total_chk" CHECK ("salon"."invoices"."total_cents" > 0 and "salon"."invoices"."tip_cents" >= 0 and "salon"."invoices"."total_cents" = "salon"."invoices"."subtotal_cents" + "salon"."invoices"."tip_cents");