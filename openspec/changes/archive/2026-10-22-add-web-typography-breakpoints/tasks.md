## 1. Генератор тем в js/cli

- [x] 1.1 Описать `ScreenName`/`Breakpoint` в `themeBuilder/types/constants.ts` и перевести `webBreakpoints` в массив из трёх экранов с прежними значениями
- [x] 1.2 Добавить `getTypographyBreakpoints` в `themeBuilder/utils/theme.ts`: блоки в порядке массива, один экран без границ — селектор без медиазапроса; медиазапрос строится без `getMediaQuery` из plasma
- [x] 1.3 Перевести `generateThemes`, `generateCSSThemes`, `generateCSSModuleThemes` на список экранов параметром
- [x] 1.4 Добавить опцию `breakpoints` в `generateThemeSet` со значением по умолчанию `webBreakpoints`

## 2. Чтение config в js/cli

- [x] 2.1 Реализовать `parseBreakpoints` в `local-theme-source.ts`: состав массива, имена и их порядок, начало и конец сетки, обе границы у промежуточных экранов; ошибка с путём к config и номером элемента
- [x] 2.2 Отдавать брейкпоинты в `LocalThemeSet.breakpoints` и пробросить через `ThemeSetSource` и `generateThemes` в `generateThemeSet`
- [x] 2.3 Упомянуть `breakpoints` в справке `generate:theme` и `generate:ds`

## 3. Project config в frontend-kt

- [x] 3.1 Добавить в `ProjectConfig` необязательное поле `breakpoints: JsonArray?`, не записываемое без значения
- [x] 3.2 Тесты кодека: config с `breakpoints` читается и записывается с тем же значением; config без него не получает ключ; обновление алиасов сохраняет поле

## 4. Тесты js/cli

- [x] 4.1 Тест: брейкпоинты из config попадают в `themes/*.ts`, `css/*__dark|light.css` и `css/*.module.css`
- [x] 4.2 Тест: без `breakpoints` вывод совпадает с прежним; описанная часть экранов выводит только их; один экран — без медиазапроса
- [x] 4.3 Тест: отсутствие начала или конца, неверный состав массива дают ошибку с путём к config до записи файлов; несостыкованные экраны допускаются
- [x] 4.4 Тест: нулевые границы `from` и `to` дают медиазапрос с `0px`

## 5. Проверка

- [x] 5.1 `cd js/cli && npm test && npm run typecheck`
- [x] 5.2 `cd frontend-kt && ./gradlew :core-workspace:allTests detekt spotlessCheck`
- [x] 5.3 `cd frontend-kt && ./gradlew build`
