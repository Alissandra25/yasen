CREATE TYPE "location_type" AS ENUM('shop', 'warehouse');--> statement-breakpoint
CREATE TABLE "locations" (
	"id" serial PRIMARY KEY,
	"business_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "location_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "locations_business_id_idx" ON "locations" ("business_id");--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_business_id_businesses_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id");