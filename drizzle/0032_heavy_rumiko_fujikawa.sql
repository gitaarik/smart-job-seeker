CREATE TABLE "resume_template_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer NOT NULL,
	"key" varchar(64) NOT NULL,
	"file_id" uuid NOT NULL,
	"date_created" timestamp with time zone,
	CONSTRAINT "resume_template_assets_template_key_unique" UNIQUE("template_id","key")
);
--> statement-breakpoint
ALTER TABLE "resume_template_assets" ADD CONSTRAINT "resume_template_assets_template_foreign" FOREIGN KEY ("template_id") REFERENCES "public"."resume_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_template_assets" ADD CONSTRAINT "resume_template_assets_file_foreign" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resume_template_assets_file_idx" ON "resume_template_assets" USING btree ("file_id");--> statement-breakpoint
-- Move the artwork out of `config` and into rows.
--
-- Only uuids that name a real `files` row are moved; a config that points at
-- something the file store never had is broken already, and this is not the
-- place to decide what it meant. Whatever is not moved is also not stripped
-- below, so nothing is lost without a row to show for it.
INSERT INTO "resume_template_assets" ("template_id", "key", "file_id", "date_created")
SELECT t."id", a."key", (a."value" #>> '{}')::uuid, now()
  FROM "resume_templates" t
  CROSS JOIN LATERAL jsonb_each(t."config" -> 'assets') AS a("key", "value")
 WHERE jsonb_typeof(t."config" -> 'assets') = 'object'
   AND jsonb_typeof(a."value") = 'string'
   AND (a."value" #>> '{}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   AND EXISTS (SELECT 1 FROM "files" f WHERE f."id" = (a."value" #>> '{}')::uuid)
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- The thumbnail sat at the top level rather than under `assets`; same slot,
-- different depth, and now the same table.
INSERT INTO "resume_template_assets" ("template_id", "key", "file_id", "date_created")
SELECT t."id", 'thumbnail', (t."config" ->> 'thumbnail')::uuid, now()
  FROM "resume_templates" t
 WHERE jsonb_typeof(t."config" -> 'thumbnail') = 'string'
   AND (t."config" ->> 'thumbnail') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   AND EXISTS (SELECT 1 FROM "files" f WHERE f."id" = (t."config" ->> 'thumbnail')::uuid)
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Strip exactly the keys that became rows, so the config stops being a second
-- answer to the same question.
UPDATE "resume_templates" t
   SET "config" = jsonb_set(
         t."config",
         '{assets}',
         (t."config" -> 'assets') - ARRAY(
           SELECT a."key" FROM "resume_template_assets" a
            WHERE a."template_id" = t."id" AND a."key" <> 'thumbnail'
         )
       )
 WHERE jsonb_typeof(t."config" -> 'assets') = 'object';--> statement-breakpoint
UPDATE "resume_templates" t
   SET "config" = t."config" - 'thumbnail'
 WHERE EXISTS (
         SELECT 1 FROM "resume_template_assets" a
          WHERE a."template_id" = t."id" AND a."key" = 'thumbnail'
       );--> statement-breakpoint
-- An `assets` object that gave up every key is noise, not an empty set.
UPDATE "resume_templates"
   SET "config" = "config" - 'assets'
 WHERE "config" -> 'assets' = '{}'::jsonb;
