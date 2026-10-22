## 1. js/cli

- [x] 1.1 `writePackagePart` с `--package` копирует папку пакета в `--out`, заменяя `src`, без `pacote`
- [x] 1.2 Справка `generate:theme`, `generate:components`, `generate:ds`
- [x] 1.3 Удалить `pacote` и `@types/pacote`
- [x] 1.4 Тест `src/package-output.test.ts`
- [x] 1.5 `lint` пакета вызывает `eslint` из `PATH`
- [x] 1.6 `copy-linaria-components.sh` не ищет компоненты без `src/components` и не вызывает `perl` без файлов; тест с открытым stdin

## 2. Проверка

- [x] 2.1 `cd js/cli && npm test && npm run typecheck`
