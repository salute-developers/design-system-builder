-- Реестр билдов Compose preview plugin (change host-compose-preview-plugin).
-- Билд принимается вместе с импортом API-меты, поэтому реестр общий для окружения и не привязан
-- к дизайн-системе или проекту. Активный билд один на платформу.

CREATE TABLE "compose_preview_plugin_builds" (
    "build_id" text PRIMARY KEY,
    "platform" "public"."component_platform" NOT NULL,
    "uikit_compose_version" text NOT NULL,
    "meta_sha256" text NOT NULL,
    "commit_sha" text NOT NULL,
    "protocol_version" integer NOT NULL,
    "zip_sha256" text NOT NULL,
    "size_bytes" bigint NOT NULL,
    "file_count" integer NOT NULL,
    "published_by" text NOT NULL,
    "published_at" timestamp DEFAULT now() NOT NULL,
    "active" boolean DEFAULT false NOT NULL,
    CONSTRAINT "compose_preview_plugin_builds_build_id_check" CHECK ("build_id" ~ '^[0-9a-f]{12}$'),
    CONSTRAINT "compose_preview_plugin_builds_meta_sha256_check" CHECK ("meta_sha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "compose_preview_plugin_builds_zip_sha256_check" CHECK ("zip_sha256" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "compose_preview_plugin_builds_active_idx"
    ON "compose_preview_plugin_builds" ("platform") WHERE "active";

CREATE INDEX "compose_preview_plugin_builds_recency_idx"
    ON "compose_preview_plugin_builds" ("platform", "published_at" DESC);
