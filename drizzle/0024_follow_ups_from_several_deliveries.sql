ALTER TABLE "delivery_notes" DROP CONSTRAINT "delivery_notes_follow_ups_have_original";--> statement-breakpoint
ALTER TABLE "delivery_notes" DROP CONSTRAINT "delivery_notes_original_note_id_delivery_notes_id_fk";
--> statement-breakpoint
DROP INDEX "delivery_notes_original_note_id_index";--> statement-breakpoint
ALTER TABLE "delivery_notes" DROP COLUMN "original_note_id";