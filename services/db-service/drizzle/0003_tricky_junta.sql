ALTER TABLE "tokens" ALTER COLUMN "variation_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tokens" ADD COLUMN "component_id" integer;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE no action ON UPDATE no action;