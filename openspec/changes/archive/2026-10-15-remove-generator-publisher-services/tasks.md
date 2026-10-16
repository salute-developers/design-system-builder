## 1. Эталон до переноса

- [x] 1.1 Сгенерировать эталон на текущем коде: `generate:ds` без `--package` и `generate:ds --package --name base` в `js/cli` по одной и той же `.sdds`; сохранить `output/src` и список файлов архива во временном каталоге вне репозитория

## 2. Перенос генератора в js/cli

- [x] 2.1 Перенести через `git mv` в `js/cli/src/generator` каталоги `componentBuilder`, `themeBuilder`, `creators`, `constants`, `templates`, `types`, `utils` и `generate.ts` из `js/services/generator/app`
- [x] 2.2 Перевести перенесённый код на ES-модули: расширения `.ts` в относительных импортах, `import.meta.dirname` вместо `__dirname`, проверка импортов CommonJS-пакетов под `tsx`
- [x] 2.3 Удалить из перенесённого кода неиспользуемое CLI: `generateDesignSystem`, выгрузку в zip, `addFolderToZip`, `getThemeData`, однотемный `generate` и `generateThemeFiles`, `readTheme`, `DB_SERVICE_URL`, `PUBLISHER_URL`, `GENERATE_ROOT_DIR`
- [x] 2.4 Добавить в `js/cli/package.json` зависимости генератора и шага `lint` пакета (`fs-extra`, `pacote`, `@salutejs/plasma-tokens-utils`, инструменты сборки пакета, `eslint` с плагинами flat-конфига, прежние `overrides`); перенести flat-конфиг lint в `constants/eslint.config.mjs` с версиями из lock-файла генератора; обновить `js/cli/package-lock.json`
- [x] 2.5 Исключить `src/generator/templates` и `src/generator/constants` в `js/cli/tsconfig.json`; добавить `result-*` в `js/cli/.gitignore` и исправить там невалидный паттерн `./node_modules` на `node_modules` (иначе strictacode обходит весь `node_modules`)
- [x] 2.6 Заменить `createRequire` и пути `../../services/generator` статическими импортами `./generator/...` в `package-output.ts`, `components.ts`, `ds.ts`, `generate-theme.ts`, `components-input.ts`, `component-source.ts`, `theme-source.ts`, `theme.test.ts`; временный каталог пакета создавать как `js/cli/result-*`; обновить тексты `--help`
- [x] 2.7 Прогнать `npm run test:cli` и сравнить `generate:ds` с эталоном из 1.1: исходники `output/src` и список файлов архива должны совпасть; отличия содержимого `.d.ts` и хелперов babel допустимы и объясняются версиями `plasma-new-hope` и `@babel/helpers`
- [x] 2.8 Добавить `npm run typecheck` в `js/cli` и вызов из `test:cli`; тест `src/generator.test.ts` на копирование `constants` и чтение манифестов и шаблонов из `templates`

## 3. Удаление сервисов в js

- [x] 3.1 Удалить остатки `js/services/generator` (`index.ts`, `routes`, `cli.ts`, Dockerfile, конфиги, `package.json`, lock-файл) и весь `js/services/publisher`
- [x] 3.2 Обновить путь к шаблонам в `js/services/db-service/src/db/import-plasma-component.ts` на `js/cli/src/generator/templates`
- [x] 3.3 Удалить скрипты `dev:generator`, `dev:publisher`, `build:generator` и их упоминания в `dev:services`/`build:services` из `js/package.json`
- [x] 3.4 Удалить сервисы `generator` и `publisher` из `js/docker-compose.dev.yml` и упоминания из `js/setup-docker.sh`

## 4. Веб-клиент

- [x] 4.1 Удалить `generateDownload`, `generatePublish`, `PublishResult` и `longPollNpm` из `js/apps/client/src/pages/Main.utils.ts` (npm-хелперы `api` остаются: их используют Overview и настройки дизайн-системы)
- [x] 4.2 Удалить действия скачивания и публикации пакета из `js/apps/client/src/pages/Debug.tsx`
- [x] 4.3 Перестроить `PublishProgress`: стадии `saving` → `documenting` → `success`/`error`, без блока npm на экране успеха; очистка черновика только после успеха
- [x] 4.4 Обновить `PublishProgress.test.tsx`: успешный сценарий, ошибка сохранения без запуска документации, ошибка документации с сохранённым черновиком

## 5. Шлюз, деплой и CI

- [x] 5.1 Удалить upstream `generator_service_api`, `publisher_service_api` и location `/api/projects/{id}/generator`, `/api/projects/{id}/publisher` из `backend-kt/identity-gateway/gateway/nginx.local.conf` и `nginx.prod.conf.template`
- [x] 5.2 Удалить сервисы `generator`, `publisher`, их `depends_on` и переменные `GENERATOR_SERVICE_UPSTREAM_*`, `PUBLISHER_SERVICE_UPSTREAM_*` (включая список `envsubst`) из `docker-compose.prod.yml`
- [x] 5.3 Удалить образы `generator` и `publisher` из матрицы `.github/workflows/publish-backend-images.yml`
- [x] 5.4 Удалить путь генератора из ESLint, шаг `Publisher syntax` и сборку `generator` из `.github/workflows/validate-js.yml`; добавить job `cli` (`npm ci`, `typecheck`, `test`)

## 6. Документация и OpenSpec

- [x] 6.1 Обновить `js/README.md`, `js/CLAUDE.md`, `js/cli/README.md`, `backend-kt/DEPLOY.md`: без сервисов generator и publisher, генератор описан как часть `js/cli`
- [x] 6.2 Обновить скилл `.claude/skills/add-component`: шаблоны в `js/cli/src/generator/templates`, проверка генератором через `npm run generate:components -- --package` вместо HTTP `generate-download`
- [x] 6.3 Обновить `openspec/config.yaml` (список JS-сервисов и стек) и `openspec/architecture/local-theme-generation.md` (путь к `themeBuilder`)
- [x] 6.4 Проверить поиском, что в репозитории не осталось ссылок на `services/generator`, `services/publisher`, `PUBLISHER_URL`, `generate-download`, `generate-publish` вне архива OpenSpec

## 7. Strictacode

- [x] 7.1 Добавить `loader.exclude` для `src/generator/templates` и `src/generator/constants` в `js/cli/.strictacode.yml` и пересчитать baseline `javascript-cli` командой `tools/strictacode baseline javascript-cli js/cli` (разрешение `strictacode-policy` дано этим Change)

## 8. Проверки

- [x] 8.1 `cd js && npm run build`, `npm run test:cli`, тесты клиента `PublishProgress`
- [x] 8.2 `cd backend-kt/identity-gateway && ./gradlew build` после правки конфигурации nginx
- [x] 8.3 `docker compose -f docker-compose.prod.yml config` с тестовыми значениями обязательных переменных проходит без сервисов `generator` и `publisher`
- [x] 8.4 `openspec validate remove-generator-publisher-services --type change --strict --no-interactive`
- [x] 8.5 [внешняя проверка] Полная сборка пакета `npm run generate:ds -- --package --name base` в чистом `js/cli` после `npm ci` (без `js/services/generator` на диске) завершается кодом 0 и пишет `.tgz`
