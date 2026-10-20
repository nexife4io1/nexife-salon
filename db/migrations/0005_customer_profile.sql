CREATE TYPE "salon"."customer_gender" AS ENUM('female', 'male', 'other', 'prefer_not_to_say');--> statement-breakpoint
ALTER TABLE "salon"."customers" ADD COLUMN "birthday" date;--> statement-breakpoint
ALTER TABLE "salon"."customers" ADD COLUMN "gender" "salon"."customer_gender";--> statement-breakpoint
ALTER TABLE "salon"."customers" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "salon"."customers" ADD COLUMN "phone_key" text;--> statement-breakpoint
-- Backfill the digits-only key. Where legacy rows already share a phone, only the oldest keeps the key
-- so the unique index below cannot fail; the others keep their phone but are not de-duplicated against.
UPDATE "salon"."customers" SET "phone_key" = NULLIF(regexp_replace("phone", '[^0-9]', '', 'g'), '') WHERE "phone" IS NOT NULL;--> statement-breakpoint
UPDATE "salon"."customers" c SET "phone_key" = NULL
FROM (
	SELECT "id", row_number() OVER (PARTITION BY "tenant_id", "phone_key" ORDER BY "created_at", "id") AS rn
	FROM "salon"."customers" WHERE "phone_key" IS NOT NULL
) d
WHERE c."id" = d."id" AND d.rn > 1;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_tenant_phone_key_uq" ON "salon"."customers" USING btree ("tenant_id","phone_key") WHERE "salon"."customers"."phone_key" is not null;