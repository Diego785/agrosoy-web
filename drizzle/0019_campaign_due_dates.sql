CREATE TABLE "due_date_extensions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"due_on" date NOT NULL,
	"reason" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "due_on" date;--> statement-breakpoint
-- Existing campaigns take Agrosoil's contract dates (D37): winter on 30 November of its year, summer
-- on 31 May of the next; never before the campaign's own end.
UPDATE "campaigns" SET "due_on" = GREATEST(
	CASE "season" WHEN 'winter' THEN make_date("year", 11, 30) ELSE make_date("year" + 1, 5, 31) END,
	"ends_on"
);--> statement-breakpoint
ALTER TABLE "campaigns" ALTER COLUMN "due_on" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "due_date_extensions" ADD CONSTRAINT "due_date_extensions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "due_date_extensions" ADD CONSTRAINT "due_date_extensions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "due_date_extensions_customer_campaign_key" ON "due_date_extensions" USING btree ("customer_id","campaign_id");--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_due_check" CHECK ("campaigns"."due_on" >= "campaigns"."ends_on");