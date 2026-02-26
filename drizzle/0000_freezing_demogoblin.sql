CREATE TYPE "public"."category_type" AS ENUM('income', 'expense');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('income', 'expense', 'transfer');--> statement-breakpoint
CREATE TYPE "public"."wallet_type" AS ENUM('cash', 'bank', 'ewallet', 'savings', 'investment');--> statement-breakpoint
CREATE TYPE "public"."workspace_role" AS ENUM('owner', 'admin', 'member', 'viewer');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dompetin_budget" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"spent" numeric(15, 2) DEFAULT '0' NOT NULL,
	"period" varchar(20) DEFAULT 'monthly' NOT NULL,
	"category_id" uuid,
	"workspace_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"is_active" boolean NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dompetin_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"icon" varchar(50) NOT NULL,
	"type" text NOT NULL,
	"color" varchar(7) NOT NULL,
	"is_system" boolean NOT NULL,
	"workspace_id" uuid,
	"user_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dompetin_goal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(1000),
	"target_amount" numeric(15, 2) NOT NULL,
	"current_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"target_date" date NOT NULL,
	"icon" varchar(50) DEFAULT '🎯' NOT NULL,
	"color" varchar(7) DEFAULT '#6366f1' NOT NULL,
	"workspace_id" uuid NOT NULL,
	"target_wallet_id" uuid,
	"is_achieved" boolean NOT NULL,
	"achieved_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "dompetin_transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"name" varchar(255) NOT NULL,
	"notes" varchar(1000),
	"date" date NOT NULL,
	"category_id" uuid,
	"wallet_id" uuid NOT NULL,
	"to_wallet_id" uuid,
	"workspace_id" uuid NOT NULL,
	"created_by" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text,
	"is_correction" boolean NOT NULL,
	"corrects_transaction_id" uuid,
	"transfer_id" uuid,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "dompetin_wallet" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" text DEFAULT 'cash' NOT NULL,
	"icon" varchar(50) NOT NULL,
	"balance" numeric(15, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"workspace_id" uuid NOT NULL,
	"is_archived" boolean NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dompetin_workspace" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"icon" varchar(10) DEFAULT '💼' NOT NULL,
	"owner_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dompetin_workspace_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dompetin_budget" ADD CONSTRAINT "dompetin_budget_category_id_dompetin_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."dompetin_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dompetin_budget" ADD CONSTRAINT "dompetin_budget_workspace_id_dompetin_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."dompetin_workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dompetin_category" ADD CONSTRAINT "dompetin_category_workspace_id_dompetin_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."dompetin_workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dompetin_category" ADD CONSTRAINT "dompetin_category_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dompetin_goal" ADD CONSTRAINT "dompetin_goal_workspace_id_dompetin_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."dompetin_workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dompetin_goal" ADD CONSTRAINT "dompetin_goal_target_wallet_id_dompetin_wallet_id_fk" FOREIGN KEY ("target_wallet_id") REFERENCES "public"."dompetin_wallet"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dompetin_transaction" ADD CONSTRAINT "dompetin_transaction_category_id_dompetin_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."dompetin_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dompetin_transaction" ADD CONSTRAINT "dompetin_transaction_wallet_id_dompetin_wallet_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."dompetin_wallet"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dompetin_transaction" ADD CONSTRAINT "dompetin_transaction_to_wallet_id_dompetin_wallet_id_fk" FOREIGN KEY ("to_wallet_id") REFERENCES "public"."dompetin_wallet"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dompetin_transaction" ADD CONSTRAINT "dompetin_transaction_workspace_id_dompetin_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."dompetin_workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dompetin_transaction" ADD CONSTRAINT "dompetin_transaction_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dompetin_transaction" ADD CONSTRAINT "dompetin_transaction_deleted_by_user_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dompetin_transaction" ADD CONSTRAINT "dompetin_transaction_corrects_transaction_id_dompetin_transaction_id_fk" FOREIGN KEY ("corrects_transaction_id") REFERENCES "public"."dompetin_transaction"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dompetin_wallet" ADD CONSTRAINT "dompetin_wallet_workspace_id_dompetin_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."dompetin_workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dompetin_workspace" ADD CONSTRAINT "dompetin_workspace_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dompetin_workspace_member" ADD CONSTRAINT "dompetin_workspace_member_workspace_id_dompetin_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."dompetin_workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dompetin_workspace_member" ADD CONSTRAINT "dompetin_workspace_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;