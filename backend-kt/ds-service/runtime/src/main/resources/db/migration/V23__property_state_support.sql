-- Признак поддержки состояний свойства (change add-property-state-support).
-- `state_combinations IS NULL` — мета ещё не сообщила признак: редактор и проверки работают как до изменения.
-- Заданный признак — флаг сочетаний и список допустимых состояний в property_supported_states; пустой список
-- значит, что свойство значения по состояниям не принимает. Значения не заполняются: признак приносит импорт меты.
ALTER TABLE properties ADD COLUMN state_combinations boolean;

CREATE TABLE property_supported_states (
    property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    state_id uuid NOT NULL REFERENCES states(id) ON DELETE CASCADE,
    PRIMARY KEY (property_id, state_id)
);

CREATE INDEX property_supported_states_state_idx ON property_supported_states (state_id);
