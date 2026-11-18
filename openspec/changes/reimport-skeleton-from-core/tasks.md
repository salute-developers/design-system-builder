## 1. Импортёр

- [x] 1.1 Снять базовую линию: dry-run `import:plasma` для `Button`, `TextField`, `Skeleton` (с `--config` и `--tokens`) до правок, отчёты сохранить во временную папку
- [x] 1.2 Загрузка аннотаций компонента из `.sdds/web/web-api-meta.json` (ключ → тип и часть) до `classify`; `checkApiMetaTypes` использует ту же загрузку
- [x] 1.3 Чтение web-значений типографики темы (`web/web_typography.json`, экран `screen-s`) для числовых частей
- [x] 1.4 Одиночная часть типографики по аннотации: `typography` с совпадающей частью → свойство с именем ключа и токеном `body.l.normal`; `dimension` с числовой частью → px из темы и «приближение»; иначе прежнее «требует решения»
- [x] 1.5 Запасное значение `var(--x, ${ident})`: токен цвета или градиента → `color` со ссылкой и «справка» про переменную; учёт в `isModelled`; несопоставленный идентификатор → прежняя ветка `value`
- [x] 1.6 Тесты в `import-plasma-component.test.ts`: запасное значение с токеном и без, одна часть `typography`, `dimension` из `fontSize`, часть без аннотации остаётся «требует решения»
- [x] 1.7 Поднять версию `js/cli` (`npm version patch --no-git-tag-version`)

## 2. Переимпорт Skeleton и сиды

- [x] 2.1 Dry-run `Skeleton`: в отчёте нет «требует решения» по `lineHeight`, `visibleLineHeight`, `gradientColor`; сравнить отчёты `Button` и `TextField` с базовой линией — изменения только в бывших «требует решения»
- [x] 2.2 `import:plasma --component=Skeleton … --apply`; манифест генератора `Skeleton` сверить с текущим, беспричинные изменения отбросить
- [x] 2.3 `seeds:update --from .sdds/components --component=Skeleton`; в сиде `gradientColor` в `view.default` (`surface.default.skeleton-gradient`) и `view.lighter` (`surface.default.skeleton-deep-gradient`), `lineHeight` и `visibleLineHeight` во всех 18 размерах со значениями, равными текущим
- [x] 2.4 Обновить контрольную сумму в `ComponentSeedsResourceTest` и `backend-kt/app/contracts/resources.sha256.json`; тест `skeleton paints the shimmer gradient` дополнить стилем `lighter`

## 3. Локальные проверки

- [x] 3.1 `npm run typecheck && npm test` в `js/cli`
- [x] 3.2 `JAVA_TOOL_OPTIONS=-Dapi.version=1.44 TESTCONTAINERS_RYUK_DISABLED=true ./gradlew :ds-service:buildAll :architecture-tests:test` в `backend-kt`
- [x] 3.3 Локальный контур: новая дизайн-система, web-превью `Skeleton` с `shimmer` видно в стилях `default` и `lighter` (скриншоты)
- [x] 3.4 `openspec validate reimport-skeleton-from-core --strict`
