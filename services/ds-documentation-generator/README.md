# Docs Generator API

Сервис для автоматической генерации документации дизайн-систем на основе данных о компонентах.

## Описание

Сервис принимает webhook с информацией о npm пакете и списком компонентов, после чего:
1. Генерирует markdown файлы через **Handlebars** шаблоны
2. Собирает статический сайт с помощью **Docusaurus**
3. Загружает результат в **S3**

## Стек технологий

- **NestJS** - backend framework
- **TypeScript** - строгая типизация
- **Handlebars** - шаблонизатор для генерации файлов
- **Docusaurus** - генератор статической документации
- **AWS S3** - хранилище статических сайтов
- **Swagger** - документация API
- **class-validator** - валидация входящих данных
- **Docker** - контейнеризация

## Требования

- Node.js >= 24.9.0
- npm

## Установка

```bash
# Установка зависимостей
npm install
```

## Конфигурация

Создайте `.env` файл в корне проекта со следующими переменными:

```env
# Server
PORT=3000

# AWS S3
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket-name
```

## Запуск

```bash
# Development режим с hot-reload
npm run start:dev

# Production режим
npm run build
npm run start:prod

# Debug режим
npm run start:debug
```

После запуска сервис доступен по адресу: `http://localhost:3000`

## API Документация

Swagger документация доступна по адресу: `http://localhost:3000/api/docs`

### Основной endpoint

**POST** `/api/documentation/generate`

Принимает webhook payload с данными о компонентах npm пакета.

#### Request Body

```json
{
  "id": "sdds-1",
  "time": "2025-10-02T12:00:00.000Z",
  "npm": {
    "name": "sdds-finai",
    "version": "0.316.0",
    "themesName": "sdds-themes",
    "themesVersion": "0.47.0"
  },
  "components": ["Button", "Checkbox", "Radiobox"]
}
```

#### Response

```json
{
  "projectId": "sdds-1",
  "url": "https://s3.amazonaws.com/bucket/sdds-1/index.html",
  "generatedAt": "2025-10-20T10:30:00.000Z"
}
```

#### Статус коды

- `201` - Документация успешно сгенерирована
- `400` - Ошибка валидации входных данных
- `500` - Внутренняя ошибка сервера

## Архитектура

```
src/
├── modules/
│   └── documentation/          # Основной модуль
│       ├── dto/               # Data Transfer Objects
│       ├── documentation.controller.ts
│       ├── documentation.service.ts
│       └── documentation.module.ts
├── services/                  # Утилитные сервисы
│   ├── template.service.ts   # Генерация файлов через Handlebars
│   ├── docusaurus.service.ts # Сборка Docusaurus сайта
│   └── s3.service.ts         # Загрузка в S3
├── templates/                 # Handlebars шаблоны и Docusaurus конфигурация
├── common/
│   └── filters/
│       └── http-exception.filter.ts  # Глобальная обработка ошибок
├── config/                    # Конфигурация приложения
├── app.module.ts
└── main.ts
```

## Docker

### Сборка образа

```bash
docker build -t docs-generator .
```

### Запуск контейнера

```bash
docker run -p 3000:3000 \
  -e AWS_ACCESS_KEY_ID=your_key \
  -e AWS_SECRET_ACCESS_KEY=your_secret \
  -e S3_BUCKET_NAME=your_bucket \
  docs-generator
```

## Формат ответов

### Успешный ответ

```json
{
  "projectId": "sdds-1",
  "url": "https://...",
  "generatedAt": "2025-10-20T10:30:00.000Z"
}
```

### Ошибка валидации

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "timestamp": "2025-10-20T10:00:00.000Z",
  "path": "/api/documentation/generate"
}
```

## Workflow генерации документации

1. **Webhook прием** - валидация входящих данных через DTO
2. **Создание временной директории** - для изоляции процесса
3. **Генерация файлов** - Handlebars обрабатывает шаблоны с данными компонентов
4. **Сборка Docusaurus** - генерация статического сайта
5. **Загрузка в S3** - публикация на CDN
6. **Очистка** - удаление временных файлов
7. **Ответ** - возврат URL сгенерированной документации
