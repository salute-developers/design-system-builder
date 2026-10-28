## 1. Перенос картинок

- [x] 1.1 Перенести используемые картинки из `js/apps/client/public/catalog/` в `js/apps/client/src/assets/catalog/` с сохранением подкаталога `icons/`
- [x] 1.2 Удалить неиспользуемые `project-cover-placeholder.svg`, `icons/rail-help.svg`, `icons/rail-notifications.svg` и пустой `public/catalog/`

## 2. Компоненты

- [x] 2.1 Заменить строковые пути `/catalog/...` на импорты в `Main.tsx`, `BuilderShell.tsx`, `Catalog.tsx`, `DesignSystemCard.tsx`, `Palette.tsx`
- [x] 2.2 Убедиться поиском, что в `js/apps/client/src` не осталось ссылок на `/catalog/` от корня домена

## 3. Тесты

- [x] 3.1 Перевести проверку картинки ошибки в `ProjectsWorkflow.test.tsx` на импортированный адрес `error-state.png`

## 4. Локальные проверки

- [x] 4.1 `cd js && npm run build` проходит
- [x] 4.2 Тесты клиента (`npm run test` в `js/apps/client`) и `npm run lint` проходят
- [x] 4.3 Собрать клиент с `BASE_URL=/dev/design-system-builder/client/` и убедиться, что в `dist` адреса картинок каталога начинаются с этого префикса или встроены как `data:`
