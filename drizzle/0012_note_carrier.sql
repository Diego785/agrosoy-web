ALTER TABLE "delivery_notes" ADD COLUMN "handed_over_by_id" uuid;--> statement-breakpoint
ALTER TABLE "delivery_notes" ADD COLUMN "carrier_name" text;--> statement-breakpoint
ALTER TABLE "delivery_notes" ADD COLUMN "carrier_vehicle" text;--> statement-breakpoint
ALTER TABLE "delivery_notes" ADD COLUMN "carrier_document_id" text;--> statement-breakpoint
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_handed_over_by_id_users_id_fk" FOREIGN KEY ("handed_over_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;