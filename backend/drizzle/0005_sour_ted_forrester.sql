ALTER TABLE "token_variations" DROP CONSTRAINT "token_variations_token_id_tokens_id_fk";
--> statement-breakpoint
ALTER TABLE "token_variations" DROP CONSTRAINT "token_variations_variation_id_variations_id_fk";
--> statement-breakpoint
ALTER TABLE "token_variations" ADD CONSTRAINT "token_variations_token_id_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_variations" ADD CONSTRAINT "token_variations_variation_id_variations_id_fk" FOREIGN KEY ("variation_id") REFERENCES "public"."variations"("id") ON DELETE cascade ON UPDATE no action;