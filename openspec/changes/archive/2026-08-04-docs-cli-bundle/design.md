## Контекст

DS Builder CLI (Kotlin Multiplatform, Clikt, Koin, Ktor Client) должен собирать самодостаточный пакет документации и отправлять его в сервис документации. Пакет содержит `manifest.json`, `docs.json`, `content/`, `assets/`, `api/` и `meta/`.

Платформенный агрегатор (Android Docs Gradle Plugin, React/Swift CLI или аналогичный)负责准备 насыщенную документацию: подставляет примеры кода, скриншоты, API-артефакты, разделяет контент на `content/core/` и `content/user/`. Результат агрегатора — директория с файлами:

```
.sdds/temp/docs/
├── structure-core.json   ← Core навигация (полное дерево страниц)
├── structure-user.json   ← User дополнения (только изменённые/новые узлы)
├── content/
│   ├── core/             ← насыщенные core markdown
│   └── user/             ← насыщенные user markdown
├── meta/                 ← components-info.json, theme-info.json, samples.json
└── assets/
    ├── examples/         ← kotlin/, xml/
    └── screenshots/      ← png файлы
```

CLI **не запускает** агрегатор, **не генерирует** content, **не запускает** платформенные инструменты. CLI принимает готовую агрегатором директорию, выполняет merge `structure-core.json` и `structure-user.json` в итоговый `docs.json`, генерирует `manifest.json`, валидирует инварианты и упаковывает всё в zip-архив.

Сервис документации — отдельный сервис (ADR-0002), CLI выступает только как consumer его REST API.

## Domain-модели пакета

### structure-core.json / structure-user.json — вход агрегатора

```
Structure
  schemaVersion: String
  navigation: List<NavigationNode>

NavigationNode
  title: String
  subjects: List<String>?       // опционально, наследуются дочерними страницами
  hidden: Boolean?
  merge: MergePolicy?           // APPEND | PREPEND | REPLACE
  items: List<NavigationNode>   // поддерево (группы/страницы)
  path: String?                 // только у leaf (страницы)
```

`structure-core.json` — полный навигационный от Core агрегатора.  
`structure-user.json` — только пользовательские изменения (добавленные/изменённые узлы).  
Формат идентичен, но `structure-user.json` содержит подмножество узлов.

### docs.json — результат generate

```
ResolvedDocs
  navigation: List<ResolvedNavigationNode>

ResolvedNavigationNode
  title: String
  subjects: List<String>            // resolved (наследование от группы)
  hidden: Boolean?
  items: List<ResolvedNavigationNode>
  path: String?                     // только у leaf
  contentFormat: String             // "markdown"
  contentRefs: List<ContentRef>

ContentRef
  source: Source                    // CORE | USER
  path: String                      // относительный путь в архиве
```

### manifest.json — описание пакета

```
Manifest
  schemaVersion: String
  designSystem: DesignSystemInfo
  platform: String                  // строка, не enum
  artifacts: List<Artifact>

DesignSystemInfo
  id: String
  version: String

Artifact
  type: ArtifactType                // RESOLVED_DOCS | CONTENT_ROOT | API_DOCS |
                                    // COMPONENTS_INFO | THEME_INFO | ASSET_ROOT
  path: String
  format: String?                   // платформенный формат, опционально
```

### ValidationError

```
ValidationError (sealed)
  ├── MissingContent(path: String)
  ├── DuplicatePath(path: String)
  ├── InvalidPathTraversal(path: String)
  ├── MissingArtifact(path: String, expected: String)
  └── StructureParseError(message: String)
```

## Архитектура фичи

```
feature/docs/
├── presentation/
│   ├── DocsCliCommand.kt              # Parent: dsbuilder docs <subcommand>
│   ├── DocsInitCliCommand.kt          # dsbuilder docs init
│   ├── DocsGenerateCliCommand.kt      # dsbuilder docs generate
│   └── DocsPublishCliCommand.kt       # dsbuilder docs publish
├── domain/
│   ├── StructureModel.kt              # Structure, NavigationNode, MergePolicy
│   ├── DocsModel.kt                   # ResolvedDocs, ResolvedNavigationNode,
│   │                                  #   ContentRef, Source
│   ├── ManifestModel.kt               # Manifest, DesignSystemInfo, Artifact,
│   │                                  #   ArtifactType
│   ├── BundleModel.kt                 # DocumentationBundle, ValidationError
│   └── MergeEngine.kt                 # merge Core + User, subjects inheritance
├── application/
│   ├── DocsInitUseCase.kt             # init command
│   ├── DocsGenerateUseCase.kt         # generate: read → merge → resolve → validate → zip
│   ├── DocsPublishUseCase.kt          # publish: upload → status
│   ├── DocsCommandModels.kt           # InitCommand, InitResult,
│   │                                  #   GenerateCommand, GenerateResult,
│   │                                  #   PublishCommand, PublishResult
│   └── DocsPorts.kt                   # FileSystem, HttpClient, Codec ports
├── data/
│   ├── JsonDocsCodec.kt               # JSON serialise/deserialise
│   ├── ZipDocsFileSystem.kt           # read/write, zip-архивация через okio
│   ├── HttpDocsPublisher.kt           # HTTP POST multipart/form-data
│   └── DocsValidationEngine.kt        # invariants validation
└── di/
    └── DocsFeatureModule.kt           # Koin wiring
```

## Границы слоёв

| Слой | Зависит от | Содержит |
|------|-----------|----------|
| **presentation** | application ports, core (`CliFileSystem`) | Clikt команды, mapping аргументов → Command, вывод результатов |
| **application** | domain, data ports | UseCase классы, Command/Result sealed interfaces |
| **domain** | (none external) | Модели пакета, MergeEngine (чистая бизнес-логика) |
| **data** | domain models, Ktor Client (HTTP), okio (zip) | JSON codec, zip-файл-операции, HTTP publisher |
| **di** | presentation, application, data | Koin wiring |

## Ключевые решения

### 1. Zip-архивация через okio

`okio` уже присутствует в проекте. Он работает в commonMain и поддерживает zip-операции без platform-specific кода. Это соответствует ограничению C1 (без зависимостей от платформы).

### 2. Входные данные — результат агрегатора

CLI принимает директорию, подготовленную платформенным агрегатором (`-docs-dir <path>`). По умолчанию CLI ищет `.sdds/temp/docs/` рядом с `.sdds/config.json`. ds id и version берутся из `.sdds/config.json` через `ProjectConfigStore`.

### 3. Merge — из structure-core.json + structure-user.json

CLI не читает author-файлы (md, structure.json). Вместо этого CLI:
- читает `structure-core.json` и `structure-user.json` из директории агрегатора;
- выполняет merge двух структур по `path` страницы;
- генерирует итоговый `docs.json` с resolved navigation и contentRefs.

### 4. REST API сервиса — заглушка

Сервис документации пока не реализован. CLI делает `POST /documentation/bundles` через существующий `AuthenticatedHttpClient` с `multipart/form-data` (файл zip). Ожидаемый ответ `{jobId, status: "accepted"}`. Если API вернёт ошибку — CLI выведет user-facing message.

## Merge Engine

### Входные данные

MergeEngine получает два дерева:
- `coreNavigation` — полное дерево из `structure-core.json`;
- `userNavigation` — подмножество узлов из `structure-user.json`.

### Наследование subjects

```
Узел с subjects: ["components.button"]
  └── Узел без subjects
       → subjects = ["components.button"]  (унаследовано)
  └── Узел с subjects: ["components.button.variant"]
       → subjects = ["components.button.variant"]  (переопределено)
```

MergeEngine проходит по дереву, накапливает `inheritedSubjects` и передаёт дочерним узлам.

### Слияние по path

1. Пройти по дереву `coreNavigation`.
2. Для каждого leaf (с `path`) найти соответствующий leaf в `userNavigation`.
3. Если `path` совпадает:
   - Если `merge = append` (default): User content добавляется после Core → `contentRefs = [core, user]`
   - Если `merge = prepend`: User content добавляется перед Core → `contentRefs = [user, core]`
   - Если `merge = replace`: User content заменяет Core → `contentRefs = [user]`
4. Если `path` отсутствует в Core: User страница добавляется как новая → `contentRefs = [user]`
5. Если `hidden = true` для User страницы: страница исключается из итоговой навигации.
6. Группы объединяются по положению в дереве и совпадающим заголовкам.

## Валидация инвариантов пакета

1. Все пути из `docs.json` contentRefs существуют в `content/`.
2. Нет duplicate paths (одинаковый path не встречается дважды).
3. Все относительные пути безопасны: нет `..`, абсолютных путей, path traversal.
4. Все артефакты, объявленные в `manifest.json`, существуют в архиве.

## Тестирование

- **Unit-тесты (commonTest)**: MergeEngine (слияние, наследование, hidden), валидация, модели (JSON serialise/deserialise).
- **HTTP-тесты (ktor-client-mock)**: HttpDocsPublisher — заглушка POST, ошибки, retry logic.
- **Integration-тесты**: docs generate end-to-end (mock FS, структура → merge → validate → zip).
