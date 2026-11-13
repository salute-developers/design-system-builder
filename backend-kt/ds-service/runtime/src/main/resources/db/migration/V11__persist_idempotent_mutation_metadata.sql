-- NULL: прежний результат без метаданных; пустая строка: подтверждённое отсутствие метаданных.
ALTER TABLE idempotent_requests ADD COLUMN response_mutation_metadata text;
