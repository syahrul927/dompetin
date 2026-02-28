ALTER TABLE "dompetin_budget" DROP CONSTRAINT "dompetin_budget_category_id_dompetin_category_id_fk";
--> statement-breakpoint
ALTER TABLE "dompetin_budget" DROP COLUMN "category_id";--> statement-breakpoint
ALTER TABLE "dompetin_budget" ADD COLUMN "icon" varchar(50) DEFAULT '💰' NOT NULL;--> statement-breakpoint
ALTER TABLE "dompetin_budget" ADD COLUMN "color" varchar(7) DEFAULT '#3b82f6' NOT NULL;--> statement-breakpoint
ALTER TABLE "dompetin_transaction" ADD COLUMN "budget_id" uuid;--> statement-breakpoint
ALTER TABLE "dompetin_transaction" ADD CONSTRAINT "dompetin_transaction_budget_id_dompetin_budget_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."dompetin_budget"("id") ON DELETE set null ON UPDATE no action;
