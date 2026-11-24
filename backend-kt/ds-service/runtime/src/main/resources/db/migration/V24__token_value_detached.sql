-- update-theme-workflow: признак отвязанного значения подтемы цветового токена (OnDark, OnLight, Inverse).
-- Путь `/detached` предметной редакции значения; по умолчанию значение связано со значениями режимов.
ALTER TABLE token_value_revisions ADD COLUMN detached boolean NOT NULL DEFAULT false;
ALTER TABLE token_value_creation_baselines ADD COLUMN detached boolean NOT NULL DEFAULT false;
