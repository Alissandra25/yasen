CREATE TYPE "user_role" AS ENUM('owner', 'seller');--> statement-breakpoint
CREATE TYPE "user_theme" AS ENUM('light', 'dark', 'system');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY,
	"business_id" integer NOT NULL,
	"user_id" integer,
	"action_type" varchar(100) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" integer,
	"product_id" integer,
	"old_value" jsonb,
	"new_value" jsonb,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" serial PRIMARY KEY,
	"name" varchar(255) NOT NULL,
	"timezone" varchar(100) DEFAULT 'Europe/Kyiv' NOT NULL,
	"currency" varchar(3) DEFAULT 'UAH' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY,
	"business_id" integer NOT NULL,
	"email" varchar(255) NOT NULL UNIQUE,
	"password_hash" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'owner'::"user_role" NOT NULL,
	"theme" "user_theme" DEFAULT 'system'::"user_theme" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_log_business_id_idx" ON "audit_log" ("business_id");--> statement-breakpoint
CREATE INDEX "audit_log_user_id_idx" ON "audit_log" ("user_id");--> statement-breakpoint
CREATE INDEX "users_business_id_idx" ON "users" ("business_id");--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_business_id_businesses_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id");--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_business_id_businesses_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id");