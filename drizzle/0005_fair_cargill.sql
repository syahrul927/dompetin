CREATE TABLE "dompetin_split_bill" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"share_code" varchar(16) NOT NULL,
	"title" varchar(255) NOT NULL,
	"subtotal" numeric(15, 2) NOT NULL,
	"tax" numeric(15, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total" numeric(15, 2) NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by" text NOT NULL,
	"transaction_id" uuid,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "dompetin_split_bill_share_code_unique" UNIQUE("share_code")
);
--> statement-breakpoint
CREATE TABLE "dompetin_split_bill_participant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"split_bill_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"is_owner" boolean NOT NULL,
	"items" text NOT NULL,
	"tax_share" numeric(15, 2) DEFAULT '0' NOT NULL,
	"discount_share" numeric(15, 2) DEFAULT '0' NOT NULL,
	"total" numeric(15, 2) NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dompetin_split_bill" ADD CONSTRAINT "dompetin_split_bill_workspace_id_dompetin_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."dompetin_workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dompetin_split_bill" ADD CONSTRAINT "dompetin_split_bill_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dompetin_split_bill" ADD CONSTRAINT "dompetin_split_bill_transaction_id_dompetin_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."dompetin_transaction"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dompetin_split_bill_participant" ADD CONSTRAINT "dompetin_split_bill_participant_split_bill_id_dompetin_split_bill_id_fk" FOREIGN KEY ("split_bill_id") REFERENCES "public"."dompetin_split_bill"("id") ON DELETE cascade ON UPDATE no action;