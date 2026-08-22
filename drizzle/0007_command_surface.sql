ALTER TABLE "budgets" RENAME COLUMN "monthly_limit" TO "limit_amount";--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "period" text DEFAULT 'month' NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_bills" ADD COLUMN "recurrence" text DEFAULT 'monthly' NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_bills" ADD COLUMN "due_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "recurring_bills" ADD COLUMN "remind_days_before" numeric;--> statement-breakpoint
ALTER TABLE "recurring_bills" ADD COLUMN "last_reminded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "recurring_bills" ALTER COLUMN "due_day_of_month" DROP NOT NULL;--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
