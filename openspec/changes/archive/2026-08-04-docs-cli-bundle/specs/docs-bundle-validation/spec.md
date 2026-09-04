## Описание

Валидация пакета документации — проверка инвариантов перед упаковкой в zip-архив. Проверяет, что все content refs существуют, пути безопасны, нет дубликатов, артефакты из manifest.json присутствуют в архиве.

## Требования

### Требование: Валидация content refs

Пользовательский интерфейс **ДОЛЖЕН** проверять, что все пути из `docs.json` contentRefs указывают на существующие файлы в `content/` директории.

**Сценарий:** Все content refs существуют
```
Дано: docs.json содержит contentRefs с путями ["content/core/button/overview.md", "content/user/button/company.md"]
Дано: файл "content/core/button/overview.md" существует
Дано: файл "content/user/button/company.md" существует
Когда: выполняется валидация пакета
Тогда: валидация проходит успешно
```

**Сценарий:** Content ref не существует
```
Дано: docs.json содержит contentRefs с путём ["content/core/button/overview.md"]
Дано: файл "content/core/button/overview.md" не существует
Когда: выполняется валидация пакета
Тогда: валидация завершается с ошибкой ValidationError.MissingContent("content/core/button/overview.md")
```

### Требование: Проверка на duplicate paths

Пользовательский интерфейс **ДОЛЖЕН** обнаруживать одинаковые относительные пути страниц в итоговой навигации.

**Сценарий:** Duplicate paths не найдены
```
Дано: docs.json содержит navigation с path ["a.md", "b.md", "c.md"]
Когда: выполняется валидация пакета
Тогда: валидация проходит успешно
```

**Сценарий:** Duplicate paths найдены
```
Дано: docs.json содержит navigation с path ["a.md", "b.md", "a.md"]
Когда: выполняется валидация пакета
Тогда: валидация завершается с ошибкой ValidationError.DuplicatePath("a.md")
```

### Требование: Проверка безопасности путей

Пользовательский интерфейс **ДОЛЖЕН** запрещать абсолютные пути, `..` и path traversal.

**Сценарий:** Безопасные пути
```
Дано: docs.json содержит contentRefs с путями ["content/core/button/overview.md"]
Когда: выполняется валидация пакетa
Тогда: валидация проходит успешно
```

**Сценарий:** Path traversal
```
Дано: docs.json содержит contentRefs с путём ["content/../../../etc/passwd"]
Когда: выполняется валидация пакетa
Тогда: валидация завершается с ошибкой ValidationError.InvalidPathTraversal("content/../../../etc/passwd")
```

**Сценарий:** Абсолютный путь
```
Дано: docs.json содержит contentRefs с путём ["/absolute/path/to/file.md"]
Когда: выполняется валидация пакетa
Тогда: валидация завершается с ошибкой ValidationError.InvalidPathTraversal("/absolute/path/to/file.md")
```

### Требование: Проверка артефактов из manifest

Пользовательский интерфейс **ДОЛЖЕН** проверять, что все артефакты, объявленные в `manifest.json`, существуют в архиве.

**Сценарий:** Все артефакты присутствуют
```
Дано: manifest.json содержит artifacts: [{"path": "docs.json"}, {"path": "content/"}]
Дано: файл "docs.json" существует
Дано: директория "content/" существует
Когда: выполняется валидация пакетa
Тогда: валидация проходит успешно
```

**Сценарий:** Артефакт отсутствует
```
Дано: manifest.json содержит artifacts: [{"path": "docs.json"}, {"path": "api/compose-api.json"}]
Дано: файл "docs.json" существует
Дано: файл "api/compose-api.json" не существует
Когда: выполняется валидация пакетa
Тогда: валидация завершается с ошибкой ValidationError.MissingArtifact("api/compose-api.json", expected)
```
