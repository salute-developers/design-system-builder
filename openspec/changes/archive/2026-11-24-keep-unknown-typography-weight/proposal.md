## Why

`typographyVariableBase` выбрасывает вес стиля, которого нет в таблице (`normal`, `medium`, `bold`): `header.h3.semibold` превращается в `h3`, и стиль молча получает имя переменной другого стиля. До выноса правил в `src/web-mapping` импортёр `import:plasma` сохранял такой вес; замечание ревью PR #193.

## What Changes

- `typographyVariableBase` оставляет незнакомый вес как есть (`header.h3.semibold` → `h3-semibold`); `normal` по-прежнему опускается, `medium` и `bold` не меняются.
- Правило общее для генератора тем, `TypographyProp`, импортёра и web-плагина превью. Клиент сейчас создаёт только `normal`, `medium`, `bold`, поэтому вывод генератора для существующих ДС не меняется.
- Версия `@sddsjs/design-system-builder-generator` поднимается до 0.2.1 (0.2.0 уже опубликована).

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `web-generator-package`: сценарий незнакомого веса в основе имени типографики.

## Impact

- `js/cli/src/web-mapping/typography.ts` и тест `web-mapping.test.ts`; `js/cli/package.json`, `package-lock.json`.
- Web-плагин в plasma получает правило с новой версией пакета генератора; до этого поведение плагина прежнее.
