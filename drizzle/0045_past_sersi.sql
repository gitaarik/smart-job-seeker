CREATE TABLE "skill_embeddings" (
	"skill" varchar(255) PRIMARY KEY NOT NULL,
	"label" varchar(255) NOT NULL,
	"embedding" jsonb NOT NULL,
	"model" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
