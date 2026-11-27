## 1. Домен: локальные ссылки markdown

- [ ] 1.1 Добавить `MarkdownLocalLinks` и `LinkRewrite` в `feature-docs/domain`: inline-ссылки, картинки и
  ссылки-определения; fenced-блоки и `code spans` не трогаются
- [ ] 1.2 Покрыть `MarkdownLocalLinks` тестами: картинка, ссылка, определение, внешние ссылки, `mailto:`, якорь, ссылка
  с `#` и `?`, код в fenced-блоке и `code span`, отказ правила

## 2. Приложение: шаг агрегации дизайна

- [ ] 2.1 Добавить `designCoreDir`, `designLayerDir` и `artifactVersion` в `DocsGenerateCommand`
- [ ] 2.2 Добавить порт `DesignDocsAggregator` и `DesignDocsRequest`
- [ ] 2.3 В `DocsGenerationSource` выбирать агрегатор дизайна для платформы `design`, сохранить отключение шага через
  `--docs-dir` и `--no-aggregate` и отклонять опции дизайна с другой платформой
- [ ] 2.4 Покрыть выбор шага тестами в `DocsGeneratePlatformStepTest`: агрегация дизайна, `--docs-dir`,
  `--no-aggregate`, ошибка агрегации без записи пакета, опции дизайна с `compose`

## 3. Данные: файловый агрегатор дизайна

- [ ] 3.1 Добавить `FilesystemDesignDocsAggregator`: поиск `core/` у предков и `docs/` в рабочей директории, явные
  каталоги, ошибка без общего слоя и без версии
- [ ] 3.2 Раскладывать дерево: очистка `.sdds/temp/docs`, `structure-core.json`, `structure-user.json`,
  `content/core|user/<path>`, `assets/core|user/**`, `meta/platform-context.json` с `sdds-design-docs` и версией
- [ ] 3.3 Переписывать ссылки страниц через `MarkdownLocalLinks`: картинки слоя — на `assets/<слой>/`, страницы слоя —
  без изменений, выход за слой, абсолютный путь и отсутствующий файл — ошибка с путём страницы и ссылки
- [ ] 3.4 Подключить агрегатор в `DocsApplicationModule`
- [ ] 3.5 Покрыть агрегатор тестами на `WorkspaceFileSystem` в памяти: оба слоя, только общий слой, явные каталоги, нет
  общего слоя, нет версии, страница структуры без файла, одинаковые имена картинок в слоях, переписанная ссылка
- [ ] 3.6 Добавить сквозной тест `DocsGenerateUseCase` для `design`: `docs.json` со слиянием `append`, `prepend`,
  `replace` и `hidden`, версия и идентификатор дизайн-системы в `manifest.json`, ссылки на картинки внутри архива

## 4. CLI

- [ ] 4.1 Добавить опции `--design-core`, `--design-layer` и `--artifact-version` в `DocsGenerateCliCommand` со
  справкой
- [ ] 4.2 Описать в `frontend-kt/cli/USAGE.md` раскладку `sdds-design-docs` и запуск сборки и публикации для вертикали
- [ ] 4.3 Покрыть разбор опций тестом команды

## 5. Проверка

- [ ] 5.1 Выполнить `tools/verify fast --change add-design-docs-aggregation`
- [ ] 5.2 Выполнить `tools/verify full --change add-design-docs-aggregation`
- [ ] 5.3 [внешняя проверка] Собрать локальный `dsbuilder` и в учебной копии раскладки `sdds-design-docs` с одной
  вертикалью выполнить `dsbuilder docs generate --platform design --artifact-version 0.0.1-test`: архив создан,
  `docs.json` содержит страницы обоих слоёв, в архиве нет ссылок на отсутствующие файлы
- [ ] 5.4 [внешняя проверка] Опубликовать этот архив `dsbuilder docs publish` в проект dev-стенда: задача обработки
  завершилась без ошибок `MISSING_LOCAL_ASSET` и `MISSING_LOCAL_LINK`, страницы и картинки читаются из публикации
