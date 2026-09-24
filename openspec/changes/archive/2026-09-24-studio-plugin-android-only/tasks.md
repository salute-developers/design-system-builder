## 1. Навигация

- [x] 1.1 Убрать `Step.PickPlatform` и `PlatformStep`; после tenant переходить сразу в `Step.ShowTokens(project, designSystem, tenant)`
- [x] 1.2 Убрать платформу из `Step.ShowTokens`, из `path()` крошек и из `TokensStep`; использовать `TOKENS_PLATFORM = ANDROID`
- [x] 1.3 Всегда передавать `resolveCodeReference` в `TokenList` (убрать проверку платформы)

## 2. Проверка

- [x] 2.1 `cd frontend-kt && ./gradlew :plugins:android-studio:build` (compile, detekt, spotless, tests)
- [x] 2.2 Вручную: после выбора tenant сразу открывается список токенов; крошки заканчиваются tenant; одиночные проект/дизайн-система/tenant пропускаются; «Копировать код» работает
