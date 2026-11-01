ALTER TABLE "products" DROP CONSTRAINT "products_code_unique";--> statement-breakpoint
ALTER TABLE "presentations" ADD COLUMN "code" text;--> statement-breakpoint
-- Presentations created before codes existed get 001, 002… in the order they were created (D23).
UPDATE "presentations" SET "code" = lpad(numbered.n::text, 3, '0')
FROM (SELECT "id", row_number() OVER (ORDER BY "created_at", "id") AS n FROM "presentations") AS numbered
WHERE numbered."id" = "presentations"."id";--> statement-breakpoint
ALTER TABLE "presentations" ALTER COLUMN "code" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "presentations_code_key" ON "presentations" USING btree ("code");--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "code";
