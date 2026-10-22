# Данные для локального контура

Файлы, которые `./setup-local.sh` берёт по умолчанию, чтобы после настройки в редакторе работало Compose-превью
компонентов без сборки чего-либо в других репозиториях.

| Каталог | Что внутри | Кто использует |
|---|---|---|
| `compose-preview/preview-compose-plugin.zip` | Собранный Compose preview plugin (Kotlin/Wasm) вместе с `api-meta.json` | `./publish-compose-plugin.sh` |
| `design-system/components/` | Пакет конфигураций компонентов: `meta.json` и `*_config.json` | `./seed-local-design-system.sh` |
| `design-system/theme/android/` | Значения токенов темы для Android (`android_color.json` и др.) | `./seed-local-design-system.sh` |
| `apply_theme_values.py` | Помощник, который переносит значения токенов темы в тему контура | `./seed-local-design-system.sh` |

Происхождение текущих файлов:

<!-- provenance:start -->
- Plugin archive: build `e66280f5dcd9` (commit `e66280f5dcd97f5a2dfd834dd343155fd5c87b07`), uikit-compose `0.55.0`, protocol 1, sha256 `b9f40b1522fa45e3c64aabbd2ae60360234dbcae190e2a4527a19c199abccf96`.
- Theme (Android values): `sdds_serv` `0.9.0` from theme-converter.
- Component package: `sdds_serv` `0.18.0`, 144 configurations, from theme-converter.
- plasma-android commit of the refresh: `e66280f5dcd97f5a2dfd834dd343155fd5c87b07`.
<!-- provenance:end -->

## Как это работает

1. `setup-local.sh` поднимает контур и публикует архив плагина командой CLI, как это делает CI plasma-android:
   бэкенд кладёт файлы в локальный MinIO, импортирует Compose API-мету из архива (компоненты и свойства глобального
   слоя) и делает билд активным.
2. `seed-local-design-system.sh` создаёт дизайн-систему `sdds_serv_local` с одноимённой темой через API (другие дизайн-системы проекта, например `base`, не
   затрагиваются). Бэкенд создаёт
   стандартный набор токенов для стартовой палитры (`malachite`). Затем помощник `apply_theme_values.py` заменяет
   значения Android (их читает Compose-превью) значениями из пакета темы `sdds_serv`, сопоставляя токены по имени.
   После этого конфигурации загружаются командой `dsbuilder components push`. Конфигурации компонентов, которых нет
   в глобальном слое, отклоняются (в текущем пакете это `bottom-sheet`).

Ограничения темы: токены форм, типографики, градиентов, теней, отступов и шрифтов совпадают с `sdds_serv`. 343 цвета в
пакете заданы ссылками на палитру (например, `[general.red.300]`), и сервер раскрывает их палитрой стартового
профиля, а не палитрой SDDS, поэтому эти цвета могут отличаться от настоящих. Значения для iOS и Web не меняются.
Девять токенов типографики и один токен формы, которых нет в пакете, сохраняют значения бэкенда.

Шрифты темы загружаются браузером с `cdn-app.sberdevices.ru`, поэтому для превью нужен доступ к этому адресу.

## Свои файлы

Опции `./setup-local.sh --plugin-zip FILE|URL`, `--components-package DIR` и `--theme-package DIR` (или переменные
`COMPOSE_PREVIEW_PLUGIN_ZIP`, `COMPOSE_COMPONENTS_PACKAGE`) заменяют файлы из этого каталога, например свежую сборку
плагина. `--skip-plugin` и `--skip-design-system` отключают шаги.

## Обновление файлов

Из чекаута plasma-android (нужны JDK 17, Node и доступ к GitHub):

```bash
./refresh-local-dev-assets.sh --plasma-android ../plasma-android
```

Скрипт собирает архив плагина и скачивает тему и пакет компонентов из публичного репозитория theme-converter в
имени и версии, которые модуль токенов объявляет в `gradle.properties` (`theme-name`, `theme-version`,
`components-name`, `components-version`). Сборка модуля токенов не нужна. Скрипт переписывает блок происхождения выше. Проверьте
`git status local-dev` и закоммитьте результат. Архив весит около 5,5 МБ, а каждая новая версия добавляет столько же
в историю репозитория, поэтому обновляйте файлы только когда меняется протокол плагина, версия `uikit-compose` или
состав компонентов.
