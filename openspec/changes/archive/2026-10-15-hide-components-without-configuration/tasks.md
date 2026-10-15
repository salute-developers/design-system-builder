## 1. Клиент

- [x] 1.1 `hasConfiguration` и фильтр Compose-компонентов при загрузке (`ThemeEditorRepository`).
- [x] 1.2 Перенаправление прямой ссылки на скрытый компонент на первый доступный.
- [x] 1.3 Тесты: `hasConfiguration`, загрузка скрывает компоненты без конфигурации.

## 2. Проверка

- [x] 2.1 В редакторе нет `DropdownLoadingState`, `Wheel`, `NavigationDrawer`, `NavigationDrawerItem`, `ModalBottomSheet`, `CollapsingNavigationBar`; ссылка на скрытый компонент ведёт на `compose-AiAnswer`.
