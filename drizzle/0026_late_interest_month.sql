ALTER TABLE "late_interest_decisions" ADD COLUMN "month" text;--> statement-breakpoint
-- Interest becomes monthly (D38). Decisions saved before (none outside test databases) keep the
-- month of the day they applied on.
UPDATE "late_interest_decisions" SET "month" = to_char("interest_date", 'YYYY-MM');
