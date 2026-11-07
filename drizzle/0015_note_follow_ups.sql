ALTER TABLE "delivery_note_lines" ADD COLUMN "original_line_id" uuid;--> statement-breakpoint
ALTER TABLE "delivery_notes" ADD COLUMN "original_note_id" uuid;--> statement-breakpoint
ALTER TABLE "delivery_note_lines" ADD CONSTRAINT "delivery_note_lines_original_line_id_delivery_note_lines_id_fk" FOREIGN KEY ("original_line_id") REFERENCES "public"."delivery_note_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_original_note_id_delivery_notes_id_fk" FOREIGN KEY ("original_note_id") REFERENCES "public"."delivery_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "delivery_note_lines_original_line_id_index" ON "delivery_note_lines" USING btree ("original_line_id");--> statement-breakpoint
CREATE INDEX "delivery_notes_original_note_id_index" ON "delivery_notes" USING btree ("original_note_id");--> statement-breakpoint
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_follow_ups_have_original" CHECK (("delivery_notes"."type" = 'delivery') = ("delivery_notes"."original_note_id" is null));