## 1. Нормализатор

- [x] 1.1 `WebApiMetaNormalizer` в `feature-components/domain/apimeta`: сведение токенов по `(componentName, id)`, имена без `state`, пропуск свойств только из токенов состояний, фильтр состояний взаимодействия, `deprecated` на уровне токена, обязательный `paramName`
- [x] 1.2 Регистрация в `ComponentsApplicationModule` для `TargetPlatform.REACT`

## 1a. Пустые компоненты

- [x] 1a.1 Нормализатор web отправляет компонент без токенов с пустыми `properties`; `Empty` — только для меты без компонентов
- [x] 1a.2 Тесты: `AvatarGroup` корпуса в манифесте без свойств; мета из одних пустых компонентов — `Normalized`, `[]` — `Empty`; сквозной тест CLI
- [x] 1a.3 Обновить KDoc, `USAGE.md`, `API_META_NORMALIZERS.md`, спеку
- [x] 1a.4 Dry run: `Created components: 1` (`Resizable`), `AvatarGroup`, `Image`, `Popup`, `Price` ушли из `Absent from meta`

## 2. Тесты

- [x] 2.1 Корпус `WebApiMetaCorpus.kt` — фрагмент реальной меты `plasma-new-hope` (`AvatarGroup`, `Button`, `Link`, `Spinner`)
- [x] 2.2 `WebApiMetaNormalizerTest`: свойства и имена, типографика, токены состояний, состояния, `skipped`, конфликты, `typeMap`, `deprecated`, `Empty`, `Invalid` для Compose, View и не-JSON
- [x] 2.3 Сквозные тесты CLI: мета web уходит с `platform = web`, мета Compose с `--platform react` отклоняется, список поддержанных платформ
- [x] 2.4 Проверка, что тесты не пустые: без фильтра токенов состояний тесты падают

## 3. Документация

- [x] 3.1 `cli/USAGE.md`, раздел «Импорт API компонентов»
- [x] 3.2 `feature-components/API_META_NORMALIZERS.md`, раздел 8 и таблица образцов

## 4. Проверка

- [x] 4.1 `./gradlew --offline spotlessApply :feature-components:jvmTest :cli:jvmTest`
- [x] 4.2 `./gradlew --offline build --continue`: зелёно всё, кроме `:plugins:android-studio` (нет офлайн-кеша `sdds-*-compose-jvm`, изменение модуль не затрагивает)
- [x] 4.3 Dry run на локальной базе по `web-api-meta.json` из `plasma-new-hope@0.384.0-dev.0`: 59 компонентов, 1887 свойств, 0 состояний; создаётся 0 компонентов, 382 свойства, 428 web-имён; `Rejected: 0`; одно расхождение типа `TabItem.itemPadding` (db `dimension`, мета `value`). Ни одно существующее свойство с web-именем не получает второго имени
