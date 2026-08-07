import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	introspect: {
		casing: 'preserve'
	},
	dbCredentials: {
		url:
			process.env.DATABASE_URL ||
			process.env.SJS_DATABASE_URL ||
			'postgres://postgres:postgres@localhost:5432/smartjobseeker'
	}
});
