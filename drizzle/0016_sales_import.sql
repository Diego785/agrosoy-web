ALTER TABLE "delivery_notes" DROP CONSTRAINT "delivery_notes_confirmed_have_number";--> statement-breakpoint
ALTER TABLE "import_batches" ADD COLUMN "sales_converted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "import_batches" ADD COLUMN "sales_converted_by" text;--> statement-breakpoint
ALTER TABLE "import_batches" ADD COLUMN "sales_campaign_id" uuid;--> statement-breakpoint
ALTER TABLE "import_batches" ADD COLUMN "sales_cutoff_date" date;--> statement-breakpoint
ALTER TABLE "delivery_notes" ADD COLUMN "imported" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_notes" ADD COLUMN "import_batch_id" uuid;--> statement-breakpoint
ALTER TABLE "delivery_notes" ADD COLUMN "sheet_number" integer;--> statement-breakpoint
CREATE INDEX "delivery_notes_import_batch_id_index" ON "delivery_notes" USING btree ("import_batch_id");--> statement-breakpoint
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_confirmed_have_number" CHECK ("delivery_notes"."status" = 'draft' or "delivery_notes"."number" is not null or "delivery_notes"."imported");