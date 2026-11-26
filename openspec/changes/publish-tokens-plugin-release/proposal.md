## Зачем

Плагин DS Builder Tokens не опубликован ни в каталоге Figma, ни в каталоге Pixso. Дизайнеры получают его сборкой от
разработчика. Нужен постоянный источник версий: архивы в GitHub Release, которые дизайнер скачивает и устанавливает из
`manifest.json`. Pixso дизайнеры уже проверили со шлюзом Yandex Cloud: он работает и в сетях, где закрыт домен
`design-system-builder.ru`.

## Что меняется

- Тег `tokens-plugin-vX.Y.Z` запускает workflow, который собирает плагин, прогоняет тесты и выкладывает в GitHub Release
  два архива: для Figma с боевым gateway и для Pixso со шлюзом Yandex Cloud.
- Скрипт упаковки проверяет, что тег совпадает с версией `package.json`, манифест указывает на файлы архива, а окно
  обращается только к gateway своего редактора. В каждый архив кладётся `README.txt` с установкой.
- Релиз создаётся без пометки Latest: ссылку `releases/latest` использует установщик CLI.
- Версия плагина становится `0.1.0`. Раздел «Публикация» в `README.md` описывает выпуск через теги вместо приватной
  публикации в организации Figma.

## Возможности

### Новые возможности

- `tokens-plugin-release`: выпуск архивов плагина для Figma и Pixso в GitHub Release.

### Изменяемые возможности

Нет. Поведение плагина в редакторах не меняется.

## Влияние

- `.github/workflows`: новый `publish-tokens-plugin-release.yml`.
- `js/apps/figma-plugin`: `scripts/release-archive.mjs`, тест `src/release.test.ts`, версия в `package.json`,
  `README.md`, `.gitignore`.
- `backend-kt`, `frontend-kt`: без изменений.
