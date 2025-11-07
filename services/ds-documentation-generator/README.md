# DS Documentation Generator

Сервис автоматической генерации документации для дизайн-систем.

## Схема работы

```
┌──────────────────┐
│  POST /generate  │  Входные данные: packageName + packageVersion
│   (REST API)     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ CLIENT_PROXY_URL │  Запрос данных о дизайн-системе
│  (Fetch API)     │  GET /design-systems/{package}/{version}
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   Handlebars     │  Генерация Docusaurus проекта из шаблонов
│   Templates      │  (structure + markdown files)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Docusaurus Build │  Сборка статического сайта через Docker
│   (npm install + │  + установка @salutejs-ds/{packageName}
│    npm run build)│
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│    AWS S3        │  Загрузка build директории
│    Upload        │  plasma.sberdevices.ru/dev/{packageName}/
└────────┬─────────┘
         │
         ▼
   Documentation URL
```

### Вход
```json
{
  "projectName": "FinAI Core",
  "packageName": "sdds-serv",
  "packageVersion": "0.1.0",
  "localOnly": false
}
```

### Выход (production mode)
```json
{
  "documentationLink": "https://plasma.sberdevices.ru/dev/sdds-serv/",
  "generatedAt": "2025-11-05T10:30:00.000Z"
}
```

### Выход (localOnly mode)
```json
{
  "localPath": "/path/to/generated-docs/sdds-serv",
  "generatedAt": "2025-11-05T10:30:00.000Z"
}
```

## Основные модули

### 1. **DocumentationController** (`src/modules/documentation/`)
- Прием REST API запросов
- Валидация входящих данных через DTO
- Endpoint: `POST /api/documentation/generate`

### 2. **DocumentationService** (`src/modules/documentation/`)
- **Fetch данных о дизайн-системе** из `CLIENT_PROXY_URL`
- **Оркестрация процесса**: генерация → сборка → деплой
- **Управление временными файлами**: создание/очистка temp директорий
- **Два режима работы**:
  - `localOnly=false` - полный цикл с деплоем в S3
  - `localOnly=true` - только генерация локального проекта
- **Cleanup старых temp директорий** при старте (`onModuleInit`)

### 3. **TemplateService** (`src/services/`)
- Генерация структуры Docusaurus проекта из Handlebars шаблонов
- Создание markdown файлов для каждого компонента
- Подготовка конфигурации `docusaurus.config.js` и `sidebars.js`

### 4. **DocusaurusService** (`src/services/`)
- Запуск сборки проекта через Docker контейнер
- Установка дополнительных пакетов (`@salutejs-ds/{packageName}`)
- Выполнение `npm install` и `npm run build`
- Возврат пути к собранной директории

### 5. **S3Service** (`src/services/`)
- Загрузка директории с build в AWS S3
- Настройка публичного доступа к файлам
- Публикация по пути: `plasma.sberdevices.ru/dev/{packageName}/`

## Быстрый старт

```bash
# Установка
npm install

# Настройка окружения
cp .env.example .env
# Заполните CLIENT_PROXY_URL и AWS credentials в .env

# Запуск
npm run start:dev
```

**API**: `http://localhost:3000/api/docs` (Swagger)

## Переменные окружения

```env
# Server
PORT=3000

# External API
CLIENT_PROXY_URL=http://localhost:3003/api

# AWS S3
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket-name

# Local generation (optional)
LOCAL_DOCS_OUTPUT_DIR=./generated-docs
```

## Технологии

- **NestJS** - фреймворк
- **Handlebars** - шаблонизация
- **Docusaurus** - генератор сайтов
- **Docker** - изоляция сборки
- **AWS S3** - хостинг
- **TypeScript** - типизация
- **class-validator** - валидация

## Docker

```bash
docker build -t docs-generator .
docker run -p 3000:3000 --env-file .env docs-generator
```
