CREATE TABLE "cash_adjustments" (
	"id" serial PRIMARY KEY,
	"business_id" integer NOT NULL,
	"location_id" integer NOT NULL,
	"date" date NOT NULL,
	"amount" integer NOT NULL,
	"note" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "cash_adjustments_location_date_idx" ON "cash_adjustments" ("location_id","date");--> statement-breakpoint
ALTER TABLE "cash_adjustments" ADD CONSTRAINT "cash_adjustments_business_id_businesses_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id");--> statement-breakpoint
ALTER TABLE "cash_adjustments" ADD CONSTRAINT "cash_adjustments_location_id_locations_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id");--> statement-breakpoint
ALTER TABLE "cash_adjustments" ADD CONSTRAINT "cash_adjustments_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id");