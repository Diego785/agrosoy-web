ALTER TABLE "charges" ADD COLUMN "concept" text DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "charges" ADD COLUMN "direction" text DEFAULT 'debit' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "concept" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "balance_before" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "balance_after" numeric(14, 2);