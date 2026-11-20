## 1. Применение снимка индекса

- [x] 1.1 `keepLoadedComponents(current, next)` в `features/themeEditor` и модульный тест
- [x] 1.2 `onSnapshot` получает `componentsScope: 'index' | 'full'`; `ThemeEditorSession.loadComponent` без имени передаёт `'index'`; тест сессии
- [x] 1.3 `useDesignSystem.applySnapshot` при `'index'` применяет `keepLoadedComponents` для web и Compose, затем `preservePendingComponents`

## 2. Проверка

- [x] 2.1 `cd js && npm run build` и тесты клиента проходят
- [x] 2.2 [внешняя проверка] На локальном стеке две правки цвета Accordion с интервалом 1,3 и 1,8 с (три прогона): поле не откатывается, значение в БД — последней правки
