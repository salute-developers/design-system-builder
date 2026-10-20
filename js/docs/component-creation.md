# Добавление компонента в конструктор дизайн-систем

Компоненты конструктора описываются двумя слоями. Глобальный слой (компонент, его свойства и web-параметры) ds-service получает из аннотаций токенов ядра `@salutejs/plasma-new-hope`. Конфигурация компонента в дизайн-системе (вариации, стили, значения) заводится пакетом `.sdds/components` в том же формате, что отдаёт `dsbuilder components fetch`. Полные правила модели, порядок проверок и накопленные прецеденты лежат в скилле `.claude/skills/add-component/SKILL.md`; здесь только маршрут.

## I / Локальный контур

Из корня репозитория:

```
$ ./setup-local.sh
```

Скрипт поднимает Kotlin backend с базой ds-service, наполняет дизайн-систему `base` через Gateway (`backend-kt/bootstrap-base.sh`) и запускает клиент на `http://localhost:3002`. Работать с компонентами нужно под системным администратором (`admin@example.com`): ему доступна базовая дизайн-система `base`, в которой и живут все компоненты.

## II / Глобальный слой

Если у компонента есть новые ключи токенов или он ещё не заведён в базе, обновите глобальный слой web-компонентов:

```
$ cd js/cli
$ npm run generate:api-meta -- --package @salutejs/plasma-new-hope     # пишет .sdds/web/web-api-meta.json
$ dsbuilder components import-api --platform react --from .sdds/web/web-api-meta.json --api-url http://localhost:8080 --apply
```

Компонент, токены которого ядро не аннотировало (в выводе `generate:api-meta` он среди «without annotations skipped»), в глобальный слой положить нечем: `components push` отклонит его пакет.

## III / Импорт из plasma

Инструмент `import:plasma` читает конфиг компонента из `packages/sdds-serv` и токены из `packages/plasma-new-hope` клона plasma (`~/Documents/work/plasma`, переопределяется `--plasma=` или `PLASMA_DIR`) и пишет пакет компонента:

```
$ cd js/cli
$ dsbuilder theme fetch                                           # тема в .sdds/tenants/<тема>/: имена токенов и значения формы
$ npm run import:plasma -- --component=TextArea                   # отчёт, файлы не трогает
$ npm run import:plasma -- --component=TextArea --apply           # пишет .sdds/components/text_area_default_config.json и манифест генератора
$ dsbuilder components push --platform react --from .sdds/components --apply   # заливает пакет в ds-service
$ npm run import:plasma -- --component=TextArea --remove --apply  # убрать записи компонента из пакета
```

Отчёт делит находки на «требует решения», «приближения» и «пропущено»; спорные места инструмент в пакет не пишет. Неизвестные токены темы задаются `--alias=<ident>=<token.name>`, радиус без токена формы — `--shape=<prop>=<round.x>`, составные компоненты — `--dir`, `--tokens`, `--config`. Связи `compose` между составным компонентом и его элементами инструмент печатает в отчёте, они заводятся через `POST /api/projects/<projectId>/ds/component-deps`.

Push переписывает только компоненты, которые есть в пакете, поэтому в `.sdds/components` перед ним должен лежать только новый компонент (или выгрузка `components fetch` плюс он). Компонент заводится в базовой дизайн-системе и больше никуда: в остальные дизайн-системы его конфигурация переносится тем же `dsbuilder components push` из их проектов.

## IV / Правки в интерфейсе

Значения, которые инструмент не выразил, правятся в редакторе тем конструктора. Если значение в конфигах указано в `rem`, его умножают на 16. Не забудьте значения по умолчанию у стилей. Состояние компонента после правок снимается выгрузкой `dsbuilder components fetch --platform react`.

## V / Стори клиента

Чтобы компонент рендерился в превью, нужна стори `apps/client/src/stories/<X>.story.tsx` по образцу `TextField.story.tsx`: все стори из `packages/sdds-serv/src/components/<X>/<X>.stories.tsx`, первая всегда `Default`. Стори регистрируется в `apps/client/src/stories/index.ts` и `apps/client/src/hooks/useStory.ts`, компонент включается в `apps/client/src/utils/menuItems.ts` (`disabled: false`). Проверка: `npx tsc -b` в `apps/client`.

## VI / Проверка генератором

```
$ cd js/cli
$ dsbuilder components fetch --platform react --to .sdds/components
$ npm run generate:components -- --package --name base
```

В архиве `output/<scope>-base-0.1.0-components.tgz` должен быть `styled-components/es/<X>/<X>.config.js`, команда должна завершиться без ошибки.

## VII / Прод

На прод компонент попадает тем же пакетом: `dsbuilder components push --platform react` на адрес продового Gateway из проекта базовой дизайн-системы. Сидов и прямого доступа к базе больше нет.
