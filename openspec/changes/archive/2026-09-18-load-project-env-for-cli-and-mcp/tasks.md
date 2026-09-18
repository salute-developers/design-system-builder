## 1. Общий источник проектного env

- [x] 1.1 Добавить общий Kotlin Multiplatform parser `.env` с согласованным форматом, ошибками без значений и тестами для кавычек, комментариев, `export`, повторов и некорректных строк.
- [x] 1.2 Добавить определение `<project-root>/.env` по найденному `configPath` и чтение одного снимка файла для локального context; покрыть вложенные проекты, `--workspace`, отсутствие файла и явный `designSystem` URI.
- [x] 1.3 Добавить scoped env resolution с приоритетом env процесса над проектным `.env`, без изменения process env или `ProcessRunner` environment.

## 2. Credential и API URL

- [x] 2.1 Подключить scoped env к общим `ApiKeyResolver`/credential provider с приоритетом `credential.name` над `DSBUILDER_API_KEY`; проверить `auto`, `project-key-env` и `user-session` policies.
- [x] 2.2 Подключить scoped env к `ApiUrlResolver` после context resolution; проверить `--api-url`, env процесса, `.env`, code default и запрет записи по code default.
- [x] 2.3 Покрыть случай неверного key: backend rejection не переключает actor на user session и не раскрывает key.

## 3. Клиенты

- [x] 3.1 Подключить project-scoped env в CLI composition root и project-scoped команды; сохранить поведение `auth`, `init`, help и явных context links без локального `.env`.
- [x] 3.2 Подключить тот же механизм в `dsbuilder mcp serve` и `dsbuilder-mcp serve`; проверить повторные вызовы одного MCP server после изменения `.env` и отсутствие утечки между context.
- [x] 3.3 Обновить `frontend-kt/cli/USAGE.md` и `frontend-kt/mcp-node/README.md` с путём `.env`, форматом, приоритетами, примером без реального секрета и ограничениями для explicit link.

## 4. Проверка

- [x] 4.1 Добавить end-to-end тесты CLI и MCP: найденный project key из `.env`, env процесса выше него, проектный API URL и отсутствие secrets в output/results.
- [x] 4.2 Выполнить `cd frontend-kt && ./gradlew build`, `./gradlew detekt` и `./gradlew spotlessCheck`; исправить проблемы только изменённых файлов и повторить неуспешные проверки.
- [x] 4.3 Выполнить `openspec validate load-project-env-for-cli-and-mcp` и проверить, что реальные `.env`/secrets не добавлены в Git.
