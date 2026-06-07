CREATE TABLE "profile_auto_import" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_input_hash" text,
	"last_synced_at" timestamp with time zone,
	"max_tasks" integer,
	"date_created" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"date_updated" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "profile_auto_import_profile_unique" UNIQUE("profile_id")
);
--> statement-breakpoint
ALTER TABLE "search_tasks" ADD COLUMN "origin" varchar(16) DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "search_tasks" ADD COLUMN "auto_managed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_auto_import" ADD CONSTRAINT "profile_auto_import_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;