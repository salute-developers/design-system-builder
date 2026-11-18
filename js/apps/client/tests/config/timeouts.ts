/** Общий slot: подготовка70s + мутация60s + четыре GET по20s + DELETE30s + запас10s. */
export const resourceFixtureTimeoutMs = 250_000;

/** Общий slot: авторизация10s + logout10s + запас10s. */
export const sessionFixtureTimeoutMs = 30_000;

/** Отдельный slot для создания и заполнения обеих тем T560; UI сохраняет свой бюджет90s. */
export const themeIsolationFixtureTimeoutMs = 120_000;

/** Готовность цветового редактора после открытия, смены темы или reload; без фиксированной задержки. */
export const colorEditorReadyTimeoutMs = 30_000;

/** Чтение данных раздела отделено от лимита действия/сохранения. */
export const sectionReadyTimeoutMs = 30_000;

/** Пилот создания ДС: критерий ответа UI и отдельный предел подтверждения позднего результата. */
export const systemCreationResponseTimeoutMs = 30_000;
export const systemCreationSettlementTimeoutMs = 60_000;
