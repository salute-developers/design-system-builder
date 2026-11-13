## Why

Сиды `Skeleton` нельзя воспроизвести из ядра: `import:plasma` теряет три значения конфига sdds-serv `LineSkeleton.config.ts`. Цвет градиента записан как `var(--plasma-colors-skeleton-gradient, ${surfaceSkeletonGradient})`, и импортёр заводит его как `value` без токена. Высоты строк записаны одной частью типографики (`${bodyL.lineHeight}`, `${bodyL.fontSize}`), и импортёр отбрасывает их как неполную шрифтовую группу. Поэтому `gradientColor` в сидах отсутствовал и превью `shimmer` было пустым. Change `add-skeleton-gradient-color` дописал значение в сиды вручную, но повторный `seeds:update --component=Skeleton` его сотрёт, а правило проекта требует, чтобы сиды содержали данные ядра.

## What Changes

- `import:plasma` берёт токен темы из запасного значения `var(--<переменная>, ${<идентификатор>})`, если запасное значение — один идентификатор цвета или градиента темы. Свойство получает тип `color` и ссылку на токен, переменная перед запятой в отчёт попадает «справкой».
- `import:plasma` разбирает одну часть типографики по аннотации глобального слоя (`.sdds/web/web-api-meta.json`):
  - ключ с типом `typography` и частью `X` при значении `${<типографика>.X}` становится свойством `typography` с именем ключа и ссылкой на токен вида `body.l.normal`;
  - ключ с типом `dimension` при значении `${<типографика>.fontSize}` или другой числовой части становится `dimension` с числом в px из web-значений темы для экрана `screen-s`, а находка попадает в «приближения».
- Без аннотации глобального слоя одиночная часть типографики, как и сейчас, попадает в «требует решения».
- `Skeleton` переимпортируется из ядра (`--config=LineSkeleton.config.ts`, `--tokens=tokens.ts`). Сиды обновляются `seeds:update`: появляется стиль `view: lighter` с токеном `surface.default.skeleton-deep-gradient`, ручная правка из `add-skeleton-gradient-color` заменяется данными ядра.
- Версия `js/cli` поднимается (`patch`).

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `plasma-component-import`: правила приведения значений дополняются запасным значением `var()` и одиночной частью типографики по аннотации глобального слоя.

## Impact

- **js:** `js/cli/src/import-plasma-component.ts` и его тесты; `js/cli/package.json` и `package-lock.json` (версия). Шаблон генератора `Skeleton` и `web-adapter.json` не меняются, если отчёт импорта не потребует.
- **backend-kt:** `ds-service/feature-components/src/main/resources/component-seeds.json` (запись `Skeleton` из `seeds:update`), контрольная сумма в `ComponentSeedsResourceTest` и `app/contracts/resources.sha256.json`. Код, схема и API ds-service не меняются.
- **frontend-kt:** не затрагивается.
- **Глобальный слой:** у `Skeleton` уже есть `gradientColor: color`, `lineHeight: typography`, `visibleLineHeight: dimension`; `components push` не меняет типы.
- **Стенды:** сиды применяются к новым дизайн-системам. Существующим значение задаётся отдельно (задача 3.1 `add-skeleton-gradient-color`).
- **Связанный change:** `add-skeleton-gradient-color` остаётся для проверки на DEV; его ручная правка сидов заменяется результатом этого change.
