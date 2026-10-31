CREATE TABLE "delivery_note_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"presentation_id" uuid NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"free_of_charge" text,
	"total" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"type" text DEFAULT 'delivery' NOT NULL,
	"number" integer,
	"note_date" date NOT NULL,
	"customer_id" uuid NOT NULL,
	"property_id" uuid,
	"campaign_id" uuid NOT NULL,
	"technician_id" uuid,
	"payment_terms" text NOT NULL,
	"exchange_rate" numeric(10, 4) NOT NULL,
	"receiver_name" text NOT NULL,
	"receiver_document_id" text,
	"receiver_relationship" text,
	"observations" text,
	"tax_invoice_number" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_notes_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "delivery_note_lines" ADD CONSTRAINT "delivery_note_lines_note_id_delivery_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."delivery_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_note_lines" ADD CONSTRAINT "delivery_note_lines_presentation_id_presentations_id_fk" FOREIGN KEY ("presentation_id") REFERENCES "public"."presentations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_property_id_customer_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."customer_properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "delivery_note_lines_note_id_index" ON "delivery_note_lines" USING btree ("note_id");--> statement-breakpoint
CREATE INDEX "delivery_notes_customer_id_index" ON "delivery_notes" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "delivery_notes_status_note_date_index" ON "delivery_notes" USING btree ("status","note_date");