CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"entry_date" date NOT NULL,
	"kind" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"reverses_entry_id" uuid,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_entries_reversesEntryId_unique" UNIQUE("reverses_entry_id"),
	CONSTRAINT "ledger_entries_amount_not_zero" CHECK ("ledger_entries"."amount" <> 0)
);
--> statement-breakpoint
CREATE TABLE "document_counters" (
	"key" text PRIMARY KEY NOT NULL,
	"next_number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_counters_next_number_positive" CHECK ("document_counters"."next_number" > 0)
);
--> statement-breakpoint
ALTER TABLE "delivery_notes" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "delivery_notes" ADD COLUMN "confirmed_by" text;--> statement-breakpoint
ALTER TABLE "delivery_notes" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "delivery_notes" ADD COLUMN "voided_by" text;--> statement-breakpoint
ALTER TABLE "delivery_notes" ADD COLUMN "void_reason" text;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_reverses_entry_id_ledger_entries_id_fk" FOREIGN KEY ("reverses_entry_id") REFERENCES "public"."ledger_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ledger_entries_customer_id_campaign_id_index" ON "ledger_entries" USING btree ("customer_id","campaign_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_source_type_source_id_index" ON "ledger_entries" USING btree ("source_type","source_id");--> statement-breakpoint
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_confirmed_have_number" CHECK ("delivery_notes"."status" = 'draft' or "delivery_notes"."number" is not null);--> statement-breakpoint
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_voided_have_reason" CHECK ("delivery_notes"."status" <> 'voided' or "delivery_notes"."void_reason" is not null);--> statement-breakpoint
-- The ledger is append-only (D6): corrections are new entries, never edits.
CREATE FUNCTION ledger_entries_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	RAISE EXCEPTION 'ledger_entries is append-only';
END;
$$;--> statement-breakpoint
CREATE TRIGGER ledger_entries_append_only BEFORE UPDATE OR DELETE ON "ledger_entries"
	FOR EACH ROW EXECUTE FUNCTION ledger_entries_append_only();
