# Tasks

## 1. Команды

- [x] 1.1 Удалить `generate:theme`, `src/index.ts` и `writeThemeSourceModules` из `src/theme-source.ts`.
- [x] 1.2 `--env-file-if-exists=../.env` оставить только у `generate:components`.

## 2. Результат генерации

- [x] 2.1 Пакет генерируется во временном каталоге `services/generator/result-cli-*`, `output` заменяется целиком.
- [x] 2.2 Без флагов в `output` копируется только `src`.
- [x] 2.3 `--package`: архив через pacote из зависимостей генератора, имя как у `npm pack`, stderr сборки при ошибке.
- [x] 2.4 README.

## 3. Проверка

- [x] 3.1 `tsc` без ошибок.
- [x] 3.2 На копии `.sdds`: без флага в `output` только `src`; с `--package` — `sddsjs-base_default-0.1.0.tgz` с `components`, `es`, `styled-components`, `theme`, `css`, `index.*`; временный каталог удалён.
