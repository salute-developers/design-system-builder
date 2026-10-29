## 1. Делегат

- [x] 1.1 `WebNpmDelegate` всегда передаёт `--out`: `--output` или `<workspaceDir>/output`
- [x] 1.2 Обновить тест аргументов скриптов в `WebNpmDelegateTest`

## 2. Проверка

- [x] 2.1 `cd frontend-kt && ./gradlew :platform-web:allTests :platform-web:detekt :platform-web:spotlessCheck :cli:jvmTest`
- [x] 2.2 Ручной запуск `dsbuilder ds generate --platform react` без `--output` пишет в `<проект>/output`
