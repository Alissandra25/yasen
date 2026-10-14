CREATE TABLE "note_types" (
	"id" serial PRIMARY KEY,
	"business_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"color" varchar(7) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_notes" (
	"id" serial PRIMARY KEY,
	"business_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"note_type_id" integer NOT NULL,
	"text" text NOT NULL,
	"valid_from" varchar(7) NOT NULL,
	"valid_to" varchar(7),
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "note_types_business_id_idx" ON "note_types" ("business_id");--> statement-breakpoint
CREATE INDEX "product_notes_business_id_idx" ON "product_notes" ("business_id");--> statement-breakpoint
CREATE INDEX "product_notes_product_id_idx" ON "product_notes" ("product_id");--> statement-breakpoint
ALTER TABLE "note_types" ADD CONSTRAINT "note_types_business_id_businesses_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id");--> statement-breakpoint
ALTER TABLE "product_notes" ADD CONSTRAINT "product_notes_business_id_businesses_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id");--> statement-breakpoint
ALTER TABLE "product_notes" ADD CONSTRAINT "product_notes_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id");--> statement-breakpoint
ALTER TABLE "product_notes" ADD CONSTRAINT "product_notes_note_type_id_note_types_id_fkey" FOREIGN KEY ("note_type_id") REFERENCES "note_types"("id");--> statement-breakpoint
ALTER TABLE "product_notes" ADD CONSTRAINT "product_notes_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id");