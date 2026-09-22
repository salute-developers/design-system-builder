# sdds-ds-compose playground

Standalone Gradle-проект для ручной проверки DS Builder CLI на Compose
дизайн-системе.

Проект не подключен к основному Gradle composite. Запускайте команды из этой
директории:

```bash
cd playground/sdds-ds-compose
```

Перед проверкой CLI положите локальный экспорт дизайн-системы из БД в `.sdds`.
Ожидаемая структура для текущих CLI-команд:

```text
.sdds/
  config.json
  tenants/
  components/
```

Примеры команд:

```bash
dsbuilder status --api-url http://localhost:8080
dsbuilder components push --api-url http://localhost:8080
dsbuilder mcp serve --workspace "$PWD" --api-url http://localhost:8080
```

`components push` по умолчанию работает в dry-run режиме. Для записи нужен
явный `--apply`.
