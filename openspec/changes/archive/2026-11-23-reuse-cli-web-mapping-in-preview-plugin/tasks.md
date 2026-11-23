## 1. Модуль `web-mapping` в `js/cli`

- [x] 1.1 `src/web-mapping/api-meta.ts`: типы меты, `basePropertyParams`, `STATE_PARAM_SUFFIX` (решение 1)
- [x] 1.2 `src/web-mapping/web-adapter.ts`: типы, `webAdapter` (`with { type: 'json' }`), `applyTemplate`, `toComponentName`, `composeOf`
- [x] 1.3 `src/web-mapping/units.ts`: `REM_BASE`, `pxToRem`, `adjustedRadius`
- [x] 1.4 `src/web-mapping/typography.ts`: `TYPOGRAPHY_PARTS`, `typographyPartFor(paramName, part?)`, `typographyVariableBase`
- [x] 1.4a `src/web-mapping/core-exports.ts`: `CoreExportNames`, `coreTokensExportName`, `coreConfigExportName`
- [x] 1.5 `src/web-mapping/theme-variables.ts`: `colorVariableName`, `DERIVED_STATE_TOKEN_SUFFIX`; `index.ts`
- [x] 1.6 Тесты функций в `src/web-mapping/*.test.ts` и тест ограничения импортов (без `node:*`, ядра и кода вне модуля, кроме `web-adapter.json`)
- [x] 1.7 `resolveJsonModule` в `tsconfig.json`; `tsconfig.web-mapping.json` (`moduleResolution: bundler`, `lib: DOM`, `types: []`, `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`); оба в `npm run typecheck`; скрипт `test` — `tsx --test 'src/**/*.test.ts'`

## 2. Генератор на общих функциях (решение 2)

- [x] 2.1 `Prop.createWebToken` → `applyTemplate`; `getAdditionalTokens` → `STATE_PARAM_SUFFIX`
- [x] 2.2 `DimensionProp` → `pxToRem`, `ShapeProp` → `adjustedRadius`; `DEFAULT_FONT_SIZE` удалена
- [x] 2.3 `TypographyProp.createWebToken` → `typographyPartFor`; `formattedTokenName`, `createTypographyTokens.ts` → `typographyVariableBase`
- [x] 2.3a `import-plasma-component.ts:421-426` → `typographyVariableBase` (решение 6); тест импортёра: `${h3Bold.fontWeight}` → `var(--plasma-typo-h3-bold-font-weight)`, `${dsplLBold.fontWeight}` → `var(--plasma-typo-dspl-l-bold-font-weight)`
- [x] 2.3b `getPlasmaTokensName`/`getPlasmaConfigName` → реэкспорты `coreTokensExportName`/`coreConfigExportName`; `ComponentManifest` генератора расширяет `CoreExportNames` модуля
- [x] 2.4 `ColorProp`, `createColorTokens`, `createGradientTokens`, `createViewContainerTokens`, `import-plasma-component.ts` → `colorVariableName`; суффиксы `ColorProp` → `DERIVED_STATE_TOKEN_SUFFIX`
- [x] 2.5 `component-source.ts`: `toApi` → `basePropertyParams`, `deps` → `composeOf`, `toComponentName` из модуля, `readComponentsMeta` принимает данные адаптера; `components-input.ts` читает `--web` или берёт `webAdapter`
- [x] 2.6 `generate-api-meta.ts` на типах модуля, экспорт `main(argv)`
- [x] 2.7 Тесты и снимки генератора проходят без изменения ожидаемых результатов

## 3. Публикация CLI

- [x] 3.1 `exports` в `package.json` (`./web-mapping`, `./package.json`); `npm pack --dry-run`, `bin` работает
- [x] 3.2 Подкоманда `api-meta` в `bin/dsbuilder-web-generator.js` и справке: обязательный `--out`, ядро от текущего каталога, без `withWorkingDirectoryDefaults`; тесты в `bin.test.ts` (совпадение с `generate:api-meta`; ошибка без `--out`; ненулевой код без ядра во временном каталоге вне репозитория)
- [x] 3.2a Подкоманда `manifests --out <файл>` в `bin` и справке; тест: запись для каждой папки шаблонов с `component.json`, ошибка без `--out`
- [x] 3.3 Удалить тест сравнения копий `web-adapter.json`; комментарии в `components-input.ts`, `component-source.ts`, сообщение «перенесите в обе копии» в `import-plasma-component.ts`
- [x] 3.4 `npm version minor --no-git-tag-version`; `npm run typecheck && npm test`
- [x] 3.5 Ручная публикация версии владельцем scope (до 4.1 в `package.json` плагина)

## 4. Плагин на пакете генератора (решение 5)

- [x] 4.1 Зависимость точной версией (`0.2.0` в `package.json` есть); до публикации проверено установкой `npm pack`-архива CLI с `--no-save`; после 3.5 — `npm install` в плагине, чтобы `package-lock.json` получил пакет
- [x] 4.2 Заменить собственные реализации импортами из `web-mapping`; `indexMeta`, `stateParamFor`, `indexTemplates`/`templateFor` переписать поверх примитивов модуля; импорт `public/api-meta.json` — только в `src/resolve/api-meta.ts`
- [x] 4.3 `getCoreTokens`/`getCoreConfig` в `cssVariables.ts` через `coreTokensExportName`/`coreConfigExportName` по `manifests[name]` из `src/generated/component-manifests.json`; удалить `coreTokensByComponent`, `coreConfigNameByComponent`
- [x] 4.3a Имена типографики темы через `typographyVariableBase` (решение 6); поправить ожидание `header.h1.medium` в `test/resolve.test.ts`, добавить случаи `display` и своей группы
- [x] 4.4 Удалить `src/data/web-adapter.json`, `public/api-meta.json`; `.gitignore` для `public/api-meta.json` и `src/generated/`
- [x] 4.5 Скрипт `generate` (`api-meta` и `manifests`) и `predev`, `prebuild`, `pretest`, `pretest:watch` на него
- [x] 4.6 Убрать `apiMetaSha256` из `public/preview-plugin.json`; поправить `test/manifest.test.ts`, `test/package.test.ts`, `scripts/package.mjs`
- [x] 4.7 `npm test`, `npm run build`; `npm version patch --no-git-tag-version` в плагине

## 5. Проверка и документация

- [x] 5.1 sha256 `dist/api-meta.json` равен прежнему `d7aa5a32…`; в бандле один экземпляр `plasma-new-hope`, размер `dist` не вырос сверх модуля
- [x] 5.2 Превью в клиенте локально (Playwright): Button, Tabs (compose), Avatar, Text — те же CSS-переменные и предупреждения, что до изменения; Calendar, Heading и CodeInput — переменные типографики `h3-bold`/`dspl-l` разрешаются
- [x] 5.3 Документация: создать `js/apps/preview-web-plugin/README.md` (порядок выпуска CLI → плагин, `npm run generate` для IDE); `.claude/skills/add-component/SKILL.md`, `js/CLAUDE.md`, `js/cli/README.md`, `backend-kt/preview/contract/README.md`; память о `web-adapter.json`
- [x] 5.4 `cd js && npm run build`, `npm run test:cli`

## 6. Данные базовой ДС

- [x] 6.1 `backend-kt/ds-service/feature-components/src/main/resources/component-seeds.json`: заменить `--plasma-typo-header-h` на `--plasma-typo-h` (Heading, Calendar, CalendarDouble, DatePicker, DateTimePicker) и `--plasma-typo-display-` на `--plasma-typo-dspl-` (Dspl); обновить sha256 в `ComponentSeedsResourceTest`
- [x] 6.2 `runtime/src/main/resources/db/migration/V23__fix_typography_variable_names.sql` (решение 8) и `TypographyVariableNamesMigrationPostgresIntegrationTest`; счётчики миграций и отпечаток схемы в `FlywayAdoptionIntegrationTest`, `FlywayPostgresIntegrationTest`, `PaletteRevisionMigrationPostgresIntegrationTest`; фикстура клиента `webBase.snapshot.json` — той же заменой
- [x] 6.3 Тесты модуля `ds-service/feature-components` (`JAVA_TOOL_OPTIONS=-Dapi.version=1.44`)
