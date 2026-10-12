## 1. Перенос прототипа

- [x] 1.1 В `plasma-android` (ветка `feature/compose-preview-web` от `develop`) перенести четыре коммита прототипа из локальной ветки `feature/preview-compose` и убедиться, что разница с ней пустая
- [x] 1.2 В `design-system-builder` перенести итоговое состояние путей прототипа из локальной ветки `feature/compose-preview`: `js/apps/client` (`src/composePreview`, правки `ComponentEditorPreview`, контроллеры, `utils/api`, `scripts/serve-compose-plugin.mjs`, `scripts/sync-preview-payload-schema.mjs`, `tests/browser`, `playwright.config.ts`, `compose-preview-smoke.html`, `README.md`), `js/docker-compose.dev.yml`, `js/setup-docker.sh`, `js/package.json`, `js/eslint.config.js`
- [x] 1.3 Не переносить `.agents/skills/openspec-*` и `scripts/import-uikit-api-meta.mjs`; убедиться, что бинарный архив плагина и распакованные Wasm-файлы не попали в индекс
- [x] 1.4 Перенести артефакты OpenSpec прототипа: архив изменения `add-compose-preview-host-to-dsbuilder-client`, активное изменение `connect-component-editor-to-compose-preview-payload` и спецификацию `compose-preview-host`; выполнить `openspec validate --specs --strict --no-interactive`

## 2. Конфигурация клиента

- [x] 2.1 Перенести настройки `include` и `restoreMocks` из блока `test` в `vite.config.ts` в существующий `vitest.config.ts` и удалить блок `test` из `vite.config.ts`
- [x] 2.2 Проверить `tsconfig.app.json` (тип `vitest/globals`) и `src/test/setup.ts` на совместимость с тестами прототипа и основой
- [x] 2.3 Привести `package.json` и `package-lock.json` клиента к единому состоянию (скрипты `dev:compose-plugin`, `test:browser-smoke`, `sync:preview-schema`, `check:preview-schema`; зависимость `@playwright/test`) без лишних изменений версий

## 3. Загрузка плагина

- [x] 3.1 Описать в `README.md` клиента сборку плагина (`previewPluginArtifact`), запуск локальной раздачи (`dev:compose-plugin`), требования к хостингу (`application/wasm` для `.wasm`, загрузка в `iframe`, доступность сетевых ресурсов плагина) и рекомендацию раздавать плагин с отдельного источника, не совпадающего с источником клиента
- [x] 3.2 Проверить, что в коде клиента нет адреса плагина по умолчанию, а локальное значение задано только в `docker-compose.dev.yml` и `setup-docker.sh`, а переменная описана в README

## 4. Условия включения и возврат

- [x] 4.1 Проверить в коде `ComponentEditorPreview` и `ComposePreviewFrame`, что без адреса плагина Compose-preview не отображается
- [x] 4.2 Добавить проверку окружения до запуска плагина (поддержка нужных возможностей Wasm) и сообщение пользователю при её отсутствии
- [x] 4.3 Убедиться тестами, что недоступный manifest, несовместимая версия протокола, отсутствие компонента в manifest, ответ плагина с ошибкой и тайм-аут готовности оставляют React-preview рабочим и сохраняют последний успешный кадр
- [x] 4.4 Добавить тесты на отсутствие влияния Compose-preview на правки токенов, тем и свойств компонентов

## 5. Проверки

- [x] 5.1 `cd js && npm run build`, линтер и модульные тесты клиента проходят
- [x] 5.2 `cd js/apps/client && npm run check:preview-schema` и браузерная проверка `playwright` проходят с настоящим плагином
- [x] 5.3 В `plasma-android` собирается `:preview-compose-plugin:previewPluginArtifact`, проходят тесты модулей `preview-contract`, `preview-sdk-compose`, `preview-compose-plugin`
- [x] 5.4 `tools/verify fast --change ship-compose-preview-on-web`
- [x] 5.5 [внешняя проверка] Запуск настоящего редактора Button с плагином отложен решением разработчика: в локальной БД нет глобального слоя компонентов платформы web (есть `compose` и `xml`), а legacy-маршрут `component-configs` отдаёт клиенту только web-компоненты, поэтому раздел «Компоненты» недоступен; вместо него отработал тестовый стенд (см. `design.md`, «Результаты проверок»)
- [x] 5.6 [внешняя проверка] Раздать архив плагина скриптом `serve-compose-plugin` и подтвердить `Content-Type: application/wasm` для `.wasm`, загрузку manifest и точки входа в `iframe` клиента и загрузку шрифтов; сохранить вывод `curl -I` и результат в браузере
- [x] 5.7 [внешняя проверка] Проверить поведение в браузерах согласованной матрицы: проверены Chrome и Safari (на тестовом стенде), Edge и Firefox отложены решением разработчика (не установлены), результаты записаны в `design.md`
- [x] 5.8 [внешняя проверка] Измерить размер архива плагина, время загрузки и время до первого рендера на холодном кеше; сохранить значения в `design.md` (порога нет, решение принимается по результату)
- [x] 5.9 Подтвердить выполненные задачи перенесённого изменения `connect-component-editor-to-compose-preview-payload` результатами проверок 5.1–5.4 и 5.6–5.8 (5.5 отложена) и архивировать его по общему процессу

## 6. Документы

- [x] 6.1 Обновить статус и описание изменения 1 в `openspec/architecture/ADR-0006-implementation-plan.md` по итогам проверок
- [x] 6.2 Внести в раздел отложенного плана ссылки на результаты измерений и принятое решение по матрице браузеров
