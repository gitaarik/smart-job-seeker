ALTER TABLE "search_tasks" RENAME COLUMN "tunnel_api_key" TO "sjsbrowser_api_key";--> statement-breakpoint
ALTER TABLE "search_tasks" DROP CONSTRAINT "search_tasks_tunnel_api_key_fkey";
--> statement-breakpoint
ALTER TABLE "search_tasks" ADD CONSTRAINT "search_tasks_sjsbrowser_api_key_fkey" FOREIGN KEY ("sjsbrowser_api_key") REFERENCES "public"."api_keys"("id") ON DELETE set null ON UPDATE no action;