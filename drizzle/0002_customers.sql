CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" integer GENERATED ALWAYS AS IDENTITY (sequence name "customers_code_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"comparison_name" text NOT NULL,
	"tax_id" text,
	"phone" text,
	"zone_id" uuid,
	"technician_id" uuid,
	"exchange_rate_kind" text DEFAULT 'daily' NOT NULL,
	"fixed_exchange_rate" numeric(10, 4),
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_code_unique" UNIQUE("code"),
	CONSTRAINT "customers_fixed_rate_check" CHECK (("customers"."exchange_rate_kind" = 'fixed') = ("customers"."fixed_exchange_rate" is not null))
);
--> statement-breakpoint
CREATE TABLE "zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"comparison_name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_comparison_name_key" ON "customers" USING btree ("comparison_name");--> statement-breakpoint
CREATE INDEX "customers_tax_id_idx" ON "customers" USING btree ("tax_id");--> statement-breakpoint
CREATE INDEX "customers_zone_id_idx" ON "customers" USING btree ("zone_id");--> statement-breakpoint
CREATE INDEX "customers_technician_id_idx" ON "customers" USING btree ("technician_id");--> statement-breakpoint
CREATE UNIQUE INDEX "zones_comparison_name_key" ON "zones" USING btree ("comparison_name");