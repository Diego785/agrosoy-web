CREATE TABLE "late_interest_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"interest_date" date NOT NULL,
	"base_usd" numeric(14, 2) NOT NULL,
	"rate_percent" numeric(5, 2) NOT NULL,
	"outcome" text NOT NULL,
	"charge_id" uuid,
	"decided_by" text NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "late_interest_decisions_charged_have_charge" CHECK ("late_interest_decisions"."outcome" <> 'charged' or "late_interest_decisions"."charge_id" is not null)
);
--> statement-breakpoint
ALTER TABLE "late_interest_decisions" ADD CONSTRAINT "late_interest_decisions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "late_interest_decisions" ADD CONSTRAINT "late_interest_decisions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "late_interest_decisions" ADD CONSTRAINT "late_interest_decisions_charge_id_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."charges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "late_interest_decisions_day_key" ON "late_interest_decisions" USING btree ("customer_id","campaign_id","interest_date");