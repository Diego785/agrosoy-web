ALTER TABLE "delivery_notes" DROP CONSTRAINT "delivery_notes_number_unique";--> statement-breakpoint
-- A voided note's printed number can be typed again on a new note (D28); the counter never gives it.
CREATE UNIQUE INDEX "delivery_notes_number_key" ON "delivery_notes" USING btree ("number") WHERE "delivery_notes"."status" <> 'voided';