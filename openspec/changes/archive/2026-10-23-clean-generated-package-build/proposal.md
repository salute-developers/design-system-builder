## Зачем

Сборка пакета, который генерирует `js/cli` (`--package`), начинается с шага `npm run lint -- --fix`.
Он ничего не даёт сборке: `--fix` только переформатирует `src`, а rollup и tsc собирают из любого
форматирования один и тот же код; `src` в опубликованный пакет не попадает (поле `files`). При этом
результат зависит от расположения `--output`: `npm run` берёт ближайший eslint выше по дереву.
В `js/cli` это eslint 9 без правил форматирования, в монорепозитории plasma — eslint 8 с
`prettier/prettier`, и `npm pack` переписывает файлы в `src/theme`, а вне репозитория eslint
не находится и сборка падает (`eslint: command not found`).

Кроме того, после `npm pack` в папке пакета остаются результаты сборки (`es`, `css`, `theme`,
`index.*`, `node_modules`), и в git-репозитории проекта их приходится чистить руками. Сам архив
`.tgz` git не игнорирует.

## Что меняется

- Из `buildSteps` в `createPackageJSON.ts` убирается `npm run lint -- --fix`, из `scripts` —
  скрипт `lint`.
- Из заготовки пакета `src/generator/constants/` удаляются `eslint.config.mjs` и `.eslintrc.js`.
- Из `devDependencies` `js/cli` удаляются `eslint`, `@eslint/js`, `typescript-eslint`,
  `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`: их использовал только lint
  генерируемого пакета. Линт репозитория (`js/eslint.config.js`) берёт свои зависимости из
  `js/package.json` и не меняется.
- Остальные шаги сборки (`copy-css-files`, `build:styled-components`, `build:css`,
  `generate:typings`) не меняются.
- `package.json` пакета получает скрипт `postpack`: если папка пакета лежит в git-репозитории и сама
  не игнорируется, после `npm pack` удаляются игнорируемые файлы папки, кроме `.tgz`.
- `.gitignore` заготовки игнорирует архив `/*.tgz` и сборочную папку `/theme` в корне пакета;
  `src/theme` под правило не попадает.

## Возможности

### Новые возможности

Нет.

### Изменяемые возможности

- `local-web-generation`: сборка сгенерированного пакета не запускает eslint и не меняет `src`;
  после `npm pack` результаты сборки удаляются.

## Влияние

- `js/cli`: `src/generator/creators/createPackageJSON.ts`, `src/generator/constants/` (включая
  `.gitignore`),
  `package.json`, `package-lock.json`, `src/generator.test.ts`, `src/package-output.test.ts`,
  `README.md`.
- `frontend-kt`, `backend-kt`, API и хранение данных не затрагиваются.
