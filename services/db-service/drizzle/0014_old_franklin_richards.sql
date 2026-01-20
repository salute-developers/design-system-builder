CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"user" text NOT NULL,
	"token" text NOT NULL,
	"design_systems" integer[] DEFAULT '{}'::integer[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_token_unique" UNIQUE("token")
);
