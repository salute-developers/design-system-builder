## 1. js/cli

- [x] 1.1 Убрать `npm run lint -- --fix` из `buildSteps` и скрипт `lint` в `createPackageJSON.ts`
- [x] 1.2 Удалить `eslint.config.mjs` и `.eslintrc.js` из `src/generator/constants/`
- [x] 1.3 Удалить eslint-зависимости из `js/cli/package.json` и синхронизировать `package-lock.json`
- [x] 1.4 Обновить `generator.test.ts`, `package-output.test.ts` и `README.md`
- [x] 1.5 Скрипт `postpack` в `createPackageJSON.ts`; `/*.tgz` и `/theme` в `.gitignore` заготовки

## 2. Проверка

- [x] 2.1 `cd js/cli && npm test && npm run typecheck`
- [x] 2.2 Пакет из одной темы с `--package` вне `js/cli`: `npm install && npm pack` проходит, `src` после сборки не изменился
- [x] 2.3 `postpack` в git-репозитории удаляет результаты сборки и сохраняет `.tgz`, вне репозитория ничего не делает
