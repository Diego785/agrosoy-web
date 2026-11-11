CREATE TABLE "opening_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"balance_date" date NOT NULL,
	"customer_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"usd_amount" numeric(14, 2) NOT NULL,
	"note" text,
	"status" text DEFAULT 'recorded' NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by" text,
	"void_reason" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "opening_balances_amount_not_zero" CHECK ("opening_balances"."usd_amount" <> 0),
	CONSTRAINT "opening_balances_voided_have_reason" CHECK ("opening_balances"."status" <> 'voided' or "opening_balances"."void_reason" is not null)
);
--> statement-breakpoint
ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "opening_balances_customer_id_index" ON "opening_balances" USING btree ("customer_id");