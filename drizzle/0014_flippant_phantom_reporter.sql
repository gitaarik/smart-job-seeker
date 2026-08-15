CREATE TABLE "capability_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"source" varchar(16) NOT NULL,
	"mcp_key_id" integer,
	"capability" varchar(64) NOT NULL,
	"target" jsonb NOT NULL,
	"fields" jsonb NOT NULL,
	"previous" jsonb NOT NULL,
	"rationale" text DEFAULT '' NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"decided_at" timestamp with time zone,
	"edit_id" integer,
	"date_created" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"profile_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"key_encrypted" text,
	"scope" varchar(16) DEFAULT 'propose' NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used" timestamp with time zone,
	"revoked" boolean DEFAULT false NOT NULL,
	"date_created" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "capability_requests" ADD CONSTRAINT "capability_requests_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capability_requests" ADD CONSTRAINT "capability_requests_key_foreign" FOREIGN KEY ("mcp_key_id") REFERENCES "public"."mcp_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_keys" ADD CONSTRAINT "mcp_keys_user_foreign" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_keys" ADD CONSTRAINT "mcp_keys_profile_foreign" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "capability_requests_profile_idx" ON "capability_requests" USING btree ("profile_id","status","date_created");--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_keys_key_hash_key" ON "mcp_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "mcp_keys_user_idx" ON "mcp_keys" USING btree ("user_id");