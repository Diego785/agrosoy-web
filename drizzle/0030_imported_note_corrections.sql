ALTER TABLE "imported_sales_lines" ALTER COLUMN "unit_price" SET DATA TYPE numeric(14, 4);--> statement-breakpoint
ALTER TABLE "delivery_note_lines" ALTER COLUMN "unit_price" SET DATA TYPE numeric(14, 4);--> statement-breakpoint
ALTER TABLE "delivery_notes" ADD COLUMN "corrected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "delivery_notes" ADD COLUMN "corrected_by" text;--> statement-breakpoint
ALTER TABLE "delivery_notes" ADD COLUMN "correction_reason" text;