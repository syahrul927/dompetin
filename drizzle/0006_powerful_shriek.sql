CREATE TABLE "dompetin_webhook" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"key_hash" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dompetin_webhook" ADD CONSTRAINT "dompetin_webhook_workspace_id_dompetin_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."dompetin_workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dompetin_webhook" ADD CONSTRAINT "dompetin_webhook_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_key_hash_idx" ON "dompetin_webhook" USING btree ("key_hash");