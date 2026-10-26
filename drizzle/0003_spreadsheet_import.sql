CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" text NOT NULL,
	"sheet_name" text NOT NULL,
	"campaign_label" text DEFAULT '' NOT NULL,
	"imported_by" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"row_number" integer,
	"code" text NOT NULL,
	"details" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imported_sales_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"kind" text NOT NULL,
	"sale_date" date,
	"product" text NOT NULL,
	"customer_name" text NOT NULL,
	"customer_key" text NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"total" numeric(14, 2) NOT NULL,
	"exchange_rate" numeric(10, 4),
	"observation" text,
	"note_number" integer
);
--> statement-breakpoint
CREATE TABLE "imported_summary_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"customer_name" text NOT NULL,
	"customer_key" text NOT NULL,
	"paid" numeric(14, 2) NOT NULL,
	"returned" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "import_issues" ADD CONSTRAINT "import_issues_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imported_sales_lines" ADD CONSTRAINT "imported_sales_lines_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imported_summary_rows" ADD CONSTRAINT "imported_summary_rows_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "import_batches_sheet_campaign_key" ON "import_batches" USING btree ("sheet_name","campaign_label");--> statement-breakpoint
CREATE INDEX "import_issues_batch_id_index" ON "import_issues" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "imported_sales_lines_batch_id_customer_key_index" ON "imported_sales_lines" USING btree ("batch_id","customer_key");--> statement-breakpoint
CREATE INDEX "imported_summary_rows_batch_id_customer_key_index" ON "imported_summary_rows" USING btree ("batch_id","customer_key");