## Контекст

`import:plasma` (`js/cli/src/import-plasma-component.ts`) приводит строки конфига sdds-serv к модели в функции `classify`. Цвет распознаётся только как голая ссылка `${идентификатор}`. Типографика собирается из шести частей одной группы (`<prefix>FontFamily` … `<prefix>LineHeight`), и одиночная часть отбрасывается. Конфиг `LineSkeleton.config.ts` использует обе формы, которые сейчас не поддерживаются:

```ts
view.default: gradientColor: var(--plasma-colors-skeleton-gradient, ${surfaceSkeletonGradient});
size.bodyL:   lineHeight: ${bodyL.lineHeight};  visibleLineHeight: ${bodyL.fontSize};
```

Ядро аннотирует эти ключи точно (`lineHeight` — `typography` с частью `lineHeight`, `visibleLineHeight` — `dimension`, `gradientColor` — `color`), а `generate:api-meta` переносит аннотации в `.sdds/web/web-api-meta.json`. Импортёр уже читает этот файл в `checkApiMetaTypes`, но только для отчёта о расхождении типов.

Текущая запись `Skeleton` в сидах досталась от db-service и задаёт `lineHeight` токенами вида `body.m.normal`, а `visibleLineHeight` — числами, совпадающими с `fontSize` экрана `screen-s` (`dsplL` = 88, `h1` = 28, `h6` = 10).

## Цели / Вне целей

**Цели:**

- импорт `Skeleton` из ядра воспроизводит сиды без ручных правок: `gradientColor` в стилях `default` и `lighter`, `lineHeight` и `visibleLineHeight` во всех 18 размерах;
- правила работают для любого компонента с такими же формами значений, а не только для `Skeleton`.

**Вне целей:**

- адаптивность `visibleLineHeight` по экранам: сид хранит одно число;
- перенос переменной перед запятой в `var(--x, …)` (переопределение темы plasma) в модель;
- изменение шаблона генератора `Skeleton`, `web-adapter.json` и глобального слоя;
- значения `Skeleton` в существующих дизайн-системах на стендах.

## Решения

### Тип одиночной части типографики берётся из `web-api-meta.json`

Импортёр загружает аннотации компонента из `.sdds/web/web-api-meta.json` один раз до `classify` и передаёт их в разбор как отображение «ключ ядра → тип и часть». Значение `${<типографика>.<часть>}`:

- при аннотации `typography` с той же частью становится свойством `typography` с именем ключа (не `<prefix>Style`) и значением `typoValue(<типографика>)`, например `body.l.normal`. Имя совпадает с web-параметром и свойством глобального слоя `lineHeight`;
- при аннотации `dimension` и числовой части (`fontSize`, `lineHeight`, `letterSpacing` в `rem`/`px`) становится `dimension` с числом в px из `.sdds/tenants/<тема>/web/web_typography.json` для `screen-s.<токен>`. В отчёт пишется «приближение».

Без аннотации или при несовпадении части поведение прежнее: «требует решения».

Почему не `@styleType` из `tokens.ts`: импортёр уже опирается на `web-api-meta.json` как на источник глобального слоя, а `components push` пишет значения под типом из него же. Второй разбор JSDoc дублировал бы `generate:api-meta` и мог бы с ним разойтись.

Почему `screen-s`: так получены текущие сиды, и это базовый экран темы sdds-serv. Альтернатива — `value` со ссылкой `var(--plasma-typo-…-font-size)` — сохранила бы адаптивность, но разошлась бы с типом `dimension` глобального слоя, а push всё равно записал бы значение как `dimension`.

### Запасное значение `var()` сводится к токену

Значение вида `var(--<переменная>, ${<идентификатор>})` с одним идентификатором в запасной части разбирается через `colorTokenName`. Если идентификатор сопоставлен токену темы (цвет или градиент), свойство получает тип `color` и ссылку на токен, как голый `${идентификатор}`. Переменная перед запятой попадает в «справку». Иначе значение уходит в прежнюю ветку `value` через `inlineThemeIdents`.

Проверка `isModelled`, которая переводит ключ со смешанными значениями в `value`, учитывает эту форму как моделируемую, чтобы `gradientColor` в `default` и `lighter` не считался смешанным.

Альтернатива — оставить строку `value` целиком. Тогда тип расходится с глобальным слоем (`color`), а редактор не покажет токен.

### Сиды `Skeleton` пишутся только через импорт и `seeds:update`

Пакет: `npm run import:plasma -- --component=Skeleton --config=<plasma>/packages/sdds-serv/src/components/Skeleton/LineSkeleton.config.ts --tokens=<plasma>/packages/plasma-new-hope/src/components/Skeleton/tokens.ts --apply`, затем `npm run seeds:update -- --from .sdds/components --component=Skeleton`. Запись `Skeleton` в `component-seeds.json` целиком заменяется результатом. Пустые значения состояний `hovered`/`pressed` у `fadeInColor`/`fadeOutColor`, доставшиеся от db-service, уходят: в ядре их нет.

Манифест генератора `Skeleton`, который пишет импорт, сверяется с текущим. Если он изменился без причины, его изменения отбрасываются.

## Риски / Компромиссы

- [Глобальный слой стенда отстаёт от `web-api-meta.json`] → сиды проверяются тестами ds-service на полном каталоге и импортом на локальном контуре; у `Skeleton` типы уже совпадают.
- [Новые правила меняют импорт уже заведённых компонентов] → прогнать dry-run импорта для нескольких компонентов с типографикой (`Button`, `TextField`) и сравнить отчёт до и после; изменения допустимы только в бывших «требует решения».
- [`visibleLineHeight` на больших экранах меньше, чем в ядре] → «приближение» в отчёте; значение совпадает с текущими сидами, поведение не ухудшается.
- [Стиль `lighter` в сидах не связан с переключателем «Lighter» в сторис] → стиль выбирается вариацией `view`; превью проверяется на стиле `default`, `lighter` проверяется выбором в инспекторе.
