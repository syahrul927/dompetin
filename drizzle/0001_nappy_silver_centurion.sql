CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "dompetin_invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_by" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dompetin_invitation" ADD CONSTRAINT "dompetin_invitation_workspace_id_dompetin_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."dompetin_workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dompetin_invitation" ADD CONSTRAINT "dompetin_invitation_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;