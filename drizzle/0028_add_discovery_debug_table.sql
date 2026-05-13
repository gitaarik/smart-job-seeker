CREATE TABLE "platform_discovery_debug" (
	"id" serial PRIMARY KEY NOT NULL,
	"discovery_run_id" integer NOT NULL,
	"stage" varchar(20) NOT NULL,
	"page_url" text NOT NULL,
	"raw_html" text NOT NULL,
	"stripped_html" text NOT NULL,
	"captured_at" timestamp (6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_discovery_debug" ADD CONSTRAINT "platform_discovery_debug_run_id_fkey" FOREIGN KEY ("discovery_run_id") REFERENCES "public"."platform_discovery_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_discovery_debug_run_id_idx" ON "platform_discovery_debug" USING btree ("discovery_run_id" int4_ops);