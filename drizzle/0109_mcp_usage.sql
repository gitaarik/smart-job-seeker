CREATE TABLE "mcp_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"period" varchar(10) NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "mcp_usage_user_id_period_key" UNIQUE("user_id","period")
);
--> statement-breakpoint
ALTER TABLE "mcp_usage" ADD CONSTRAINT "mcp_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;