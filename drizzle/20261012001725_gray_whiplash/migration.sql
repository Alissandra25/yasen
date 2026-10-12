CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY,
	"business_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"contacts" text,
	"note" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "suppliers_business_id_idx" ON "suppliers" ("business_id");--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_business_id_businesses_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id");