-- Add tunnel_api_key column to search_tasks (selected device for tunnel scraping)
ALTER TABLE "search_tasks" ADD COLUMN "tunnel_api_key" INTEGER;

-- Foreign key to api_keys (set null on delete so revoking a key doesn't break tasks)
ALTER TABLE "search_tasks"
  ADD CONSTRAINT "search_tasks_tunnel_api_key_fkey"
  FOREIGN KEY ("tunnel_api_key") REFERENCES "api_keys"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
