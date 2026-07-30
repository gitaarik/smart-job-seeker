CREATE TABLE "ai_generations" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" integer NOT NULL,
	"mode" varchar(50),
	"started_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ai_generations_entity_unique" ON "ai_generations" USING btree ("entity_type","entity_id");