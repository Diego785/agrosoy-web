ALTER TABLE "late_interest_decisions" DROP CONSTRAINT "late_interest_decisions_due_campaign_id_campaigns_id_fk";
--> statement-breakpoint
DROP INDEX "late_interest_decisions_due_key";--> statement-breakpoint
ALTER TABLE "late_interest_decisions" ALTER COLUMN "month" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "late_interest_decisions_month_key" ON "late_interest_decisions" USING btree ("customer_id","campaign_id","month");--> statement-breakpoint
ALTER TABLE "late_interest_decisions" DROP COLUMN "due_campaign_id";