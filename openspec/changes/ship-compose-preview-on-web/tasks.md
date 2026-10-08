## 1. Перенос прототипа

- [ ] 1.1 В `plasma-android` (ветка `feature/compose-preview-web` от `develop`) перенести четыре коммита прототипа из локальной ветки `feature/preview-compose` и убедиться, что разница с ней пустая
- [ ] 1.2 В `design-system-builder` перенести итоговое состояние путей прототипа из локальной ветки `feature/compose-preview`: `js/apps/client` (`src/composePreview`, правки `ComponentEditorPreview`, контроллеры, `utils/api`, `scripts/serve-compose-plugin.mjs`, `scripts/sync-preview-payload-schema.mjs`, `tests/browser`, `playwright.config.ts`, `compose-preview-smoke.html`, `.env.example`, `README.md`), `js/docker-compose.dev.yml`, `js/setup-docker.sh`, `js/package.json`, `js/eslint.config.js`
- [ ] 1.3 Не переносить `.agents/skills/openspec-*` и `scripts/import-uikit-api-meta.mjs`; убедиться, что бинарный архив плагина и распакованные Wasm-файлы не попали в индекс
- [ ] 1.4 Перенести артефакты OpenSpec прототипа: архив изменения `add-compose-preview-host-to-dsbuilder-client`, активное изменение `connect-component-editor-to-compose-preview-payload` и спецификацию `compose-preview-host`; выполнить `openspec validate --specs --strict --no-interactive`

## 2. Конфигурация клиента

- [ ] 2.1 Перенести настройки `include` и `restoreMocks` из блока `test` в `vite.config.ts` в существующий `vitest.config.ts` и удалить блок `test` из `vite.config.ts`
- [ ] 2.2 Проверить `tsconfig.app.json` (тип `vitest/globals`) и `src/test/setup.ts` на совместимость с тестами прототипа и основой
- [ ] 2.3 Привести `package.json` и `package-lock.json` клиента к единому состоянию (скрипты `dev:compose-plugin`, `test:browser-smoke`, `sync:preview-schema`, `check:preview-schema`; зависимость `@playwright/test`) без лишних изменений версий

## 3. Доставка плагина

- [ ] 3.1 Описать в `README.md` клиента сборку плагина, структуру версионированного адреса `.../compose-preview/{версия}/`, ручную команду выкладки `s3cmd` в S3 с проверкой загруженного адреса и откат сменой переменной
- [ ] 3.2 Передать `VITE_COMPOSE_PREVIEW_PLUGIN_URL` из переменных репозитория (`vars`) шагу сборки клиента в `deploy-front-apps-dev.yml` и `deploy-front-apps-prom.yml`; отсутствие переменной MUST оставлять Compose-preview выключенным
- [ ] 3.3 Убедиться, что каталог плагина в хранилище лежит вне синхронизируемого каталога клиента и не затрагивается `--delete-removed`
- [ ] 3.4 Зафиксировать в `README.md` клиента условия безопасности размещения плагина на одном источнике с клиентом: только плагин SDDS, ограниченный круг лиц с правом записи в каталог плагина, запрет сторонних плагинов до выделения отдельного имени хоста
- [ ] 3.5 Проверить, что при сборке клиента нет значения по умолчанию для адреса плагина, кроме явно локального в `docker-compose.dev.yml` и `setup-docker.sh`

## 4. Условия включения и возврат

- [ ] 4.1 Проверить в коде `ComponentEditorPreview` и `ComposePreviewFrame`, что без адреса плагина Compose-preview не отображается
- [ ] 4.2 Добавить проверку окружения до запуска плагина (поддержка нужных возможностей Wasm) и сообщение пользователю при её отсутствии
- [ ] 4.3 Убедиться тестами, что недоступный manifest, несовместимая версия протокола, отсутствие компонента в manifest, ответ плагина с ошибкой и тайм-аут готовности оставляют React-preview рабочим и сохраняют последний успешный кадр
- [ ] 4.4 Добавить тесты на отсутствие влияния Compose-preview на правки токенов, тем и свойств компонентов

## 5. Проверки

- [ ] 5.1 `cd js && npm run build`, линтер и модульные тесты клиента проходят
- [ ] 5.2 `cd js/apps/client && npm run check:preview-schema` и браузерная проверка `playwright` проходят с настоящим плагином
- [ ] 5.3 В `plasma-android` собирается `:preview-compose-plugin:previewPluginArtifact`, проходят тесты модулей `preview-contract`, `preview-sdk-compose`, `preview-compose-plugin`
- [ ] 5.4 `tools/verify fast --change ship-compose-preview-on-web`
- [ ] 5.5 [внешняя проверка] Запустить клиент с плагином, собранным из ветки `feature/compose-preview-web` `plasma-android`; изменить цвет токена, размер и форму свойства и состояние в редакторе Button без перезагрузки `iframe`; сохранить краткий протокол
- [ ] 5.6 [внешняя проверка] Выложить плагин в хранилище DEV по версионированному адресу и подтвердить `Content-Type: application/wasm` для `.wasm`, загрузку manifest и точки входа в `iframe` клиента DEV и загрузку шрифтов; сохранить выводы `curl -I` и результат в браузере
- [ ] 5.7 [внешняя проверка] Проверить поведение в браузерах согласованной матрицы: либо работает Compose-preview, либо показано сообщение и доступен React-preview; сохранить таблицу результатов (Chrome, Edge, Firefox обязательны; Safari проверяется, при неработоспособности достаточно сообщения и React-preview)
- [ ] 5.8 [внешняя проверка] Измерить размер архива плагина, время загрузки и время до первого рендера на холодном кеше; сохранить значения в `design.md` (порога нет, решение принимается по результату)
- [ ] 5.9 Подтвердить выполненные задачи перенесённого изменения `connect-component-editor-to-compose-preview-payload` результатами проверок 5.1–5.5 и архивировать его по общему процессу

## 6. Документы

- [ ] 6.1 Обновить статус и описание изменения 1 в `openspec/architecture/ADR-0006-implementation-plan.md` по итогам проверок
- [ ] 6.2 Внести в раздел отложенного плана ссылки на результаты измерений и принятое решение по матрице браузеров
