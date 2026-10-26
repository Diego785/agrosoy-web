CREATE TABLE "role_permission_overrides" (
	"role" text NOT NULL,
	"permission" text NOT NULL,
	"granted" boolean NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permission_overrides_role_permission_pk" PRIMARY KEY("role","permission")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ALTER COLUMN "entity_id" SET DATA TYPE text;