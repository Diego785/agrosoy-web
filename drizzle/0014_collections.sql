CREATE TABLE "charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"charge_date" date NOT NULL,
	"customer_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"usd_amount" numeric(14, 2) NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'recorded' NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by" text,
	"void_reason" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "charges_amount_positive" CHECK ("charges"."usd_amount" > 0),
	CONSTRAINT "charges_voided_have_reason" CHECK ("charges"."status" <> 'voided' or "charges"."void_reason" is not null)
);
--> statement-breakpoint
CREATE TABLE "daily_exchange_rates" (
	"rate_date" date PRIMARY KEY NOT NULL,
	"rate" numeric(10, 4) NOT NULL,
	"recorded_by" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"note_id" uuid,
	"usd_amount" numeric(14, 2) NOT NULL,
	CONSTRAINT "payment_allocations_amount_positive" CHECK ("payment_allocations"."usd_amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_number" integer NOT NULL,
	"payment_date" date NOT NULL,
	"customer_id" uuid NOT NULL,
	"currency" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"exchange_rate" numeric(10, 4) NOT NULL,
	"usd_amount" numeric(14, 2) NOT NULL,
	"method" text NOT NULL,
	"in_kind_description" text,
	"reference" text,
	"observations" text,
	"settles_note_id" uuid,
	"status" text DEFAULT 'recorded' NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by" text,
	"void_reason" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_receiptNumber_unique" UNIQUE("receipt_number"),
	CONSTRAINT "payments_amounts_positive" CHECK ("payments"."amount" > 0 and "payments"."usd_amount" > 0),
	CONSTRAINT "payments_voided_have_reason" CHECK ("payments"."status" <> 'voided' or "payments"."void_reason" is not null)
);
--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_note_id_delivery_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."delivery_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_settles_note_id_delivery_notes_id_fk" FOREIGN KEY ("settles_note_id") REFERENCES "public"."delivery_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "charges_customer_id_index" ON "charges" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_payment_id_index" ON "payment_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_note_id_index" ON "payment_allocations" USING btree ("note_id");--> statement-breakpoint
CREATE INDEX "payments_customer_id_index" ON "payments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "payments_payment_date_index" ON "payments" USING btree ("payment_date");--> statement-breakpoint
CREATE INDEX "payments_settles_note_id_index" ON "payments" USING btree ("settles_note_id");