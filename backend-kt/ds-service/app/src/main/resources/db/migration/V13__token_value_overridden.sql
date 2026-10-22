-- Своё значение платформы у значения токена темы (add-sizes-tokens-editor, правило add-color-token-gradients):
-- `true` — значение ios или android задано вручную и не перестраивается из значения web.
-- Признак — предметное поле редакции значения: он входит в изменённые пути, журнал, откат и опубликованные
-- версии. Прежние редакции и исходные точки начальных значений получают `false`.

ALTER TABLE token_value_revisions ADD COLUMN overridden boolean NOT NULL DEFAULT false;

ALTER TABLE token_value_creation_baselines ADD COLUMN overridden boolean NOT NULL DEFAULT false;
