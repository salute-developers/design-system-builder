-- Разовое дописывание вариации `view` конфигурациям черновиков (change component-editor-variation-selection).
-- Сами данные пишет задача ViewAxisBackfill при старте ds-service: редакции черновика идут через блокировку
-- черновика и журнал, поэтому SQL-миграция их не пишет. Таблица хранит дизайн-системы, существовавшие
-- на момент обновления; новые получают `view` из шаблона и импорта. Отметка `completed_at` ставится
-- в той же транзакции, что и записи дизайн-системы, поэтому повторный старт её не трогает.
CREATE TABLE view_axis_backfill (
    design_system_id uuid PRIMARY KEY REFERENCES design_systems(id) ON DELETE CASCADE,
    completed_at timestamp
);

INSERT INTO view_axis_backfill(design_system_id) SELECT id FROM design_systems;
