## 1. Делегат

- [x] 1.1 Объявить `COMPONENTS` в capabilities
- [x] 1.2 Перевести capability в `components generate --sdds` с тем же разбором `--output` и passthrough
- [x] 1.3 Убрать ветку `Unsupported` и сообщение про генерацию вместе с темой

## 2. Проверка

- [x] 2.1 Тесты делегата на argv компонентов и состав capabilities
- [x] 2.2 `./gradlew build`
- [x] 2.3 E2E на реальных бинарях: theme generate → components generate → docs generate
