CREATE TABLE "demo_link_devices" (
	"id" serial PRIMARY KEY NOT NULL,
	"demo_link_id" integer NOT NULL,
	"api_key_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demo_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" varchar(255) NOT NULL,
	"created_by" text NOT NULL,
	"ttl_seconds" integer NOT NULL,
	"expires_at" timestamp (6) with time zone NOT NULL,
	"max_runs" integer,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"demo_user_id" text,
	"date_created" timestamp (6) with time zone DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_demo_template" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "demo_link_devices" ADD CONSTRAINT "demo_link_devices_demo_link_id_fkey" FOREIGN KEY ("demo_link_id") REFERENCES "public"."demo_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo_link_devices" ADD CONSTRAINT "demo_link_devices_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo_links" ADD CONSTRAINT "demo_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo_links" ADD CONSTRAINT "demo_links_demo_user_id_fkey" FOREIGN KEY ("demo_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "demo_link_devices_link_key_unique" ON "demo_link_devices" USING btree ("demo_link_id" int4_ops,"api_key_id" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "demo_links_token_unique" ON "demo_links" USING btree ("token" text_ops);--> statement-breakpoint
CREATE INDEX "idx_demo_links_created_by" ON "demo_links" USING btree ("created_by" text_ops);--> statement-breakpoint
CREATE INDEX "idx_demo_links_demo_user" ON "demo_links" USING btree ("demo_user_id" text_ops);