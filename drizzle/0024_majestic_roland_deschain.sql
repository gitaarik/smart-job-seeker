CREATE TABLE "skill_aliases" (
	"id" serial PRIMARY KEY NOT NULL,
	"concept_id" integer NOT NULL,
	"alias" varchar(255) NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_concepts" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(255) NOT NULL,
	"label" varchar(255) NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_relations" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_id" integer NOT NULL,
	"to_id" integer NOT NULL,
	"relation" varchar(32) NOT NULL,
	"confidence" double precision,
	"source" varchar(32) DEFAULT 'llm' NOT NULL,
	"approved_at" timestamp with time zone,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tech_skills" ADD COLUMN "concept_id" integer;--> statement-breakpoint
ALTER TABLE "skill_aliases" ADD CONSTRAINT "skill_aliases_concept_foreign" FOREIGN KEY ("concept_id") REFERENCES "public"."skill_concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_relations" ADD CONSTRAINT "skill_relations_from_foreign" FOREIGN KEY ("from_id") REFERENCES "public"."skill_concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_relations" ADD CONSTRAINT "skill_relations_to_foreign" FOREIGN KEY ("to_id") REFERENCES "public"."skill_concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "skill_aliases_alias_key" ON "skill_aliases" USING btree ("alias");--> statement-breakpoint
CREATE INDEX "skill_aliases_concept_idx" ON "skill_aliases" USING btree ("concept_id");--> statement-breakpoint
CREATE UNIQUE INDEX "skill_concepts_slug_key" ON "skill_concepts" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "skill_relations_edge_key" ON "skill_relations" USING btree ("from_id","to_id","relation");--> statement-breakpoint
CREATE INDEX "skill_relations_from_idx" ON "skill_relations" USING btree ("from_id");--> statement-breakpoint
CREATE INDEX "skill_relations_to_idx" ON "skill_relations" USING btree ("to_id");--> statement-breakpoint
ALTER TABLE "tech_skills" ADD CONSTRAINT "tech_skills_concept_foreign" FOREIGN KEY ("concept_id") REFERENCES "public"."skill_concepts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tech_skills_concept_idx" ON "tech_skills" USING btree ("concept_id");