DROP INDEX "late_interest_decisions_day_key";--> statement-breakpoint
ALTER TABLE "late_interest_decisions" ADD COLUMN "due_campaign_id" uuid;--> statement-breakpoint
-- Decisions saved before (none outside test databases): the last due date on or before their day,
-- never earlier than the debt's own campaign.
UPDATE "late_interest_decisions" AS "decision"
SET "due_campaign_id" = coalesce(
  (
    SELECT "due"."id"
    FROM "campaigns" AS "due", "campaigns" AS "own"
    WHERE "own"."id" = "decision"."campaign_id"
      AND "due"."due_on" >= "own"."due_on"
      AND "due"."due_on" <= "decision"."interest_date"
    ORDER BY "due"."due_on" DESC, "due"."id"
    LIMIT 1
  ),
  "decision"."campaign_id"
);--> statement-breakpoint
ALTER TABLE "late_interest_decisions" ALTER COLUMN "due_campaign_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "late_interest_decisions" ADD CONSTRAINT "late_interest_decisions_due_campaign_id_campaigns_id_fk" FOREIGN KEY ("due_campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "late_interest_decisions_due_key" ON "late_interest_decisions" USING btree ("customer_id","campaign_id","due_campaign_id");
