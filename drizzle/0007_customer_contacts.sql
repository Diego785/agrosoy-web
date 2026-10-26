CREATE TABLE "authorized_receivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"document_id" text,
	"relationship" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technician_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"technician_id" uuid NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "authorized_receivers" ADD CONSTRAINT "authorized_receivers_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_properties" ADD CONSTRAINT "customer_properties_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_assignments" ADD CONSTRAINT "technician_assignments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_assignments" ADD CONSTRAINT "technician_assignments_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "authorized_receivers_customer_id_index" ON "authorized_receivers" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_properties_customer_id_index" ON "customer_properties" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "technician_assignments_customer_id_index" ON "technician_assignments" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "technician_assignments_open_key" ON "technician_assignments" USING btree ("customer_id") WHERE "technician_assignments"."ends_at" is null;--> statement-breakpoint
-- Customers that already had a technician start their portfolio history now.
INSERT INTO "technician_assignments" ("customer_id", "technician_id") SELECT "id", "technician_id" FROM "customers" WHERE "technician_id" IS NOT NULL;
