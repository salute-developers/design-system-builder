-- Своё значение платформы у значения токена темы (add-sizes-tokens-editor, правило add-color-token-gradients):
-- `true` — значение ios или android задано вручную и не перестраивается из значения web.
-- Прежние значения получают `false`.

ALTER TABLE "token_values" ADD COLUMN "overridden" boolean NOT NULL DEFAULT false;
