## Why

Импорт дизайн-системы из файла темы спрятан в отладочном меню редактора: оно появляется только при `localStorage.debug_mode`, требует заранее открыть любую дизайн-систему и создаёт новую систему в проекте открытой, а не в проекте, который пользователь выбрал. Запрос идёт в legacy-маршрут db-service. Выгрузить дизайн-систему в файл, который принимает импорт, из интерфейса нельзя.

Импорт и экспорт нужны как обычная функция каталога дизайн-систем проекта, пока только для владельца проекта.

## What Changes

- В каталоге проекта и в окне создания дизайн-системы появляется импорт из файла темы (`.zip` сборки темы или `.json`).
- Импорт выполняется клиентом существующими ручками ds-service: `POST /design-systems`, `POST /tenants` и одним пакетным `PUT /tenants/{id}/token-values` со всеми значениями файла. Токены файла, которых нет в наборе новой дизайн-системы, пропускаются, пользователь видит их список.
- Дизайн-система создаётся в проекте из адреса страницы.
- В меню «три точки» карточки дизайн-системы в каталоге проекта появляется «Экспортировать»: данные темы `<имя>_default` (или первой темы) в том виде, в каком их собирает редактор, сохраняются в `<имя>.json`.
- Импорт и экспорт показываются только владельцу проекта (`effectiveRole = owner`; системный администратор получает эту роль в любом проекте).
- Из отладочного меню редактора убираются «Импортировать дизайн систему» и «Скачать тему»: они ходили в legacy-маршруты db-service и заменены новыми импортом и экспортом. db-service и бэкенд не меняются.

## Capabilities

### New Capabilities

### Modified Capabilities

- `web-design-system-workflow`: импорт дизайн-системы из файла темы в каталоге проекта и экспорт из меню карточки дизайн-системы для владельца проекта; из отладочного меню убираются старые импорт и скачивание темы.

## Impact

- **js/apps/client**: `modules/projects/domain/permissions.ts` (`designSystems:import`/`designSystems:export` у `owner`), `modules/designSystems/application/importThemeFile.ts` и `themeFile.ts`, `designSystemsApi.tokens`, `themesApi.saveTokenValues`, `CreateDesignSystemPage` и `ImportDesignSystemForm`, `ProjectOverview`, пункт меню экспорта в `DesignSystemCard`/`CardMenu` (`exportDesignSystemFile.ts`), `workflow.css`, `pages/Debug.tsx`, `pages/Main.utils.ts`.
- **backend-kt**, **frontend-kt**, **js/services/db-service**, `authorization/policy.json`: не затрагиваются. Ограничение «только владелец» действует в интерфейсе; сервер проверяет права самих ручек (`design-systems:write`, `tenants:write`).
