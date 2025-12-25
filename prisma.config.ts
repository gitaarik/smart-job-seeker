import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Use DATABASE_URL from environment (set by docker-compose or shell)
    url: process.env.DATABASE_URL || process.env.SJS_DATABASE_URL,
  },
});
