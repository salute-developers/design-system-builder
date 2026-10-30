-- Реестр билдов preview plugin общий для платформ compose и web (change publish-web-preview-plugin):
-- версия библиотеки билда (uikitComposeVersion для compose, plasmaNewHopeVersion для web) хранится в общей колонке.
-- Данные не меняются. Обратная миграция для отката ds-service:
--   ALTER TABLE "compose_preview_plugin_builds" RENAME COLUMN "library_version" TO "uikit_compose_version";

ALTER TABLE "compose_preview_plugin_builds" RENAME COLUMN "uikit_compose_version" TO "library_version";
