CREATE TYPE "logo_slot" AS ENUM('mark', 'lockup');--> statement-breakpoint
CREATE TYPE "logo_theme" AS ENUM('light', 'dark');--> statement-breakpoint
CREATE TABLE "business_logo_assets" (
	"id" serial PRIMARY KEY,
	"business_id" integer NOT NULL,
	"slot" "logo_slot" NOT NULL,
	"theme" "logo_theme" NOT NULL,
	"image" bytea NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_logo_assets_business_slot_theme_key" UNIQUE("business_id","slot","theme")
);
--> statement-breakpoint
ALTER TABLE "businesses" DROP COLUMN "logo";--> statement-breakpoint
ALTER TABLE "businesses" DROP COLUMN "logo_mime_type";--> statement-breakpoint
CREATE INDEX "business_logo_assets_business_id_idx" ON "business_logo_assets" ("business_id");--> statement-breakpoint
ALTER TABLE "business_logo_assets" ADD CONSTRAINT "business_logo_assets_business_id_businesses_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id");