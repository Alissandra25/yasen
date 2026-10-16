ALTER TYPE "stock_adjustment_reason" ADD VALUE 'count_error' BEFORE 'other';--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD COLUMN "comment" varchar(500);