ALTER TABLE "users" DROP COLUMN "work_zone";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "work_zone_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_work_zone_id_zones_id_fk" FOREIGN KEY ("work_zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;