CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season" text NOT NULL,
	"year" integer NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_period_check" CHECK ("campaigns"."ends_on" > "campaigns"."starts_on")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "campaigns_season_year_key" ON "campaigns" USING btree ("season","year");