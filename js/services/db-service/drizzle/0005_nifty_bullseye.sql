CREATE TABLE "component_style_reference_styles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_id" uuid NOT NULL,
	"style_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "component_style_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"design_system_id" uuid NOT NULL,
	"invariant_property_value_id" uuid,
	"variation_property_value_id" uuid,
	"style_combination_id" uuid,
	"target_appearance_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "csr_exactly_one_source" CHECK ((
        ("component_style_references"."invariant_property_value_id" is not null)::int +
        ("component_style_references"."variation_property_value_id" is not null)::int +
        ("component_style_references"."style_combination_id" is not null)::int
      ) = 1)
);
--> statement-breakpoint
ALTER TABLE "component_style_reference_styles" ADD CONSTRAINT "component_style_reference_styles_reference_id_component_style_references_id_fk" FOREIGN KEY ("reference_id") REFERENCES "public"."component_style_references"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_style_reference_styles" ADD CONSTRAINT "component_style_reference_styles_style_id_styles_id_fk" FOREIGN KEY ("style_id") REFERENCES "public"."styles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_style_references" ADD CONSTRAINT "component_style_references_design_system_id_design_systems_id_fk" FOREIGN KEY ("design_system_id") REFERENCES "public"."design_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_style_references" ADD CONSTRAINT "component_style_references_invariant_property_value_id_invariant_property_values_id_fk" FOREIGN KEY ("invariant_property_value_id") REFERENCES "public"."invariant_property_values"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_style_references" ADD CONSTRAINT "component_style_references_variation_property_value_id_variation_property_values_id_fk" FOREIGN KEY ("variation_property_value_id") REFERENCES "public"."variation_property_values"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_style_references" ADD CONSTRAINT "component_style_references_style_combination_id_style_combinations_id_fk" FOREIGN KEY ("style_combination_id") REFERENCES "public"."style_combinations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_style_references" ADD CONSTRAINT "component_style_references_target_appearance_id_appearances_id_fk" FOREIGN KEY ("target_appearance_id") REFERENCES "public"."appearances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "csrs_reference_id_style_id_unique" ON "component_style_reference_styles" USING btree ("reference_id","style_id");--> statement-breakpoint
CREATE UNIQUE INDEX "csr_invariant_value_unique" ON "component_style_references" USING btree ("invariant_property_value_id") WHERE invariant_property_value_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "csr_variation_value_unique" ON "component_style_references" USING btree ("variation_property_value_id") WHERE variation_property_value_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "csr_style_combination_unique" ON "component_style_references" USING btree ("style_combination_id") WHERE style_combination_id is not null;--> statement-breakpoint
CREATE INDEX "csr_target_appearance_idx" ON "component_style_references" USING btree ("target_appearance_id");