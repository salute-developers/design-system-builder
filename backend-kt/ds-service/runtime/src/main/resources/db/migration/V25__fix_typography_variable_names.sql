-- Имена CSS-переменных типографики темы в значениях свойств компонентов — как в @salutejs/plasma-typo и в теме,
-- которую пишет web-генератор: `--plasma-typo-h3-bold-*`, `--plasma-typo-dspl-l-*`. Импорт компонентов plasma
-- записывал несуществующие `--plasma-typo-header-h3-bold-*` и `--plasma-typo-display-l-*`; они попали в сиды
-- и из них — в дизайн-системы. Заменяются только имена в форме импортёра: системный стиль (`h1`…`h6` или размер
-- `l`/`m`/`s` дисплея), необязательный вес `bold`/`medium` и поле типографики. Переменные семейства группы
-- (`--plasma-typo-header-font-family`, `--plasma-typo-display-font-family`) и переменные пользовательских стилей
-- группы `header` (`header.display-promo.normal` → `--plasma-typo-display-promo-*`) не меняются.
--
-- Значения лежат только в редакциях; черновик и опубликованные версии читают одни и те же строки, поэтому правка
-- на месте исправляет все границы. Журнал, ревизия черновика и состояния правки не меняются: на UPDATE реагирует
-- только `*_touch_draft`, он отключается на время миграции (как в V15). Прежние значения — в v25_typography_backup.
--
-- TODO: удалить v25_typography_backup (и v15_color_token_backup) отдельной миграцией, когда V25 применена на prod
-- и превью исправленных компонентов проверено.
SET LOCAL lock_timeout = '5s';

CREATE TABLE v25_typography_backup (
    id bigserial PRIMARY KEY,
    source_table text NOT NULL,
    row_id uuid NOT NULL,
    previous_value text NOT NULL,
    backed_up_at timestamp NOT NULL DEFAULT now()
);

CREATE FUNCTION v25_fix_typography_variables(value text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT regexp_replace(
        regexp_replace(
            value,
            '--plasma-typo-header-(h[1-6]-(?:bold-|medium-)?'
                || '(?:font-family|font-weight|font-style|font-size|line-height|letter-spacing))(?![[:alnum:]_-])',
            '--plasma-typo-\1', 'g'
        ),
        '--plasma-typo-display-([lms]-(?:bold-|medium-)?'
            || '(?:font-family|font-weight|font-style|font-size|line-height|letter-spacing))(?![[:alnum:]_-])',
        '--plasma-typo-dspl-\1', 'g'
    )
$$;

DO $$
DECLARE
    revision_table text;
BEGIN
    FOREACH revision_table IN ARRAY ARRAY[
        'invariant_property_value_revisions',
        'variation_property_value_revisions',
        'style_combination_revisions',
        'invariant_platform_param_adjustment_revisions',
        'variation_platform_param_adjustment_revisions'
    ] LOOP
        -- Строки опубликованных и исходных границ неизменяемы для приложения; правка на месте только на время миграции.
        EXECUTE format('ALTER TABLE %I DISABLE TRIGGER %I', revision_table, revision_table || '_touch_draft');
        EXECUTE format(
            'WITH changed AS ('
            '    SELECT id, value FROM %1$I'
            '    WHERE value IS DISTINCT FROM v25_fix_typography_variables(value)'
            '), backup AS ('
            '    INSERT INTO v25_typography_backup (source_table, row_id, previous_value)'
            '    SELECT %2$L, id, value FROM changed'
            ')'
            ' UPDATE %1$I revision SET value = v25_fix_typography_variables(changed.value)'
            ' FROM changed WHERE revision.id = changed.id',
            revision_table, revision_table
        );
        EXECUTE format('ALTER TABLE %I ENABLE TRIGGER %I', revision_table, revision_table || '_touch_draft');
    END LOOP;
END
$$;

DROP FUNCTION v25_fix_typography_variables(text);
