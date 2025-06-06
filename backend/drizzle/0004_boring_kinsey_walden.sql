CREATE TABLE "token_variations" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_id" integer NOT NULL,
	"variation_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "token_variations_token_id_variation_id_unique" UNIQUE("token_id","variation_id")
);
--> statement-breakpoint
ALTER TABLE "tokens" DROP CONSTRAINT "tokens_variation_id_variations_id_fk";
--> statement-breakpoint
ALTER TABLE "token_variations" ADD CONSTRAINT "token_variations_token_id_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_variations" ADD CONSTRAINT "token_variations_variation_id_variations_id_fk" FOREIGN KEY ("variation_id") REFERENCES "public"."variations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tokens" DROP COLUMN "variation_id";