CREATE TABLE "customer_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"comparison_name" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "identity_card" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "usual_payment_terms" text;--> statement-breakpoint
ALTER TABLE "customer_aliases" ADD CONSTRAINT "customer_aliases_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_aliases_comparison_name_key" ON "customer_aliases" USING btree ("comparison_name");--> statement-breakpoint
CREATE INDEX "customer_aliases_customer_id_index" ON "customer_aliases" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customers_identity_card_idx" ON "customers" USING btree ("identity_card");