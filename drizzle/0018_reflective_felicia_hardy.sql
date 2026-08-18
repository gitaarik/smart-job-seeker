CREATE TABLE "github_app_installations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"installation_id" integer NOT NULL,
	"account_login" varchar(255),
	"account_type" varchar(32),
	"date_created" timestamp with time zone DEFAULT now(),
	"date_updated" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "github_app_installations" ADD CONSTRAINT "github_app_installations_user_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "github_app_installations_user_installation_unique" ON "github_app_installations" USING btree ("user_id","installation_id");