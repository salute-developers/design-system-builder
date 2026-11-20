## 1. Клиент S3

- [x] 1.1 `ComposePreviewPluginConfiguration.createStorage`: `requestChecksumCalculation(WHEN_REQUIRED)` и `responseChecksumValidation(WHEN_REQUIRED)` у `S3Client`
- [ ] 1.2 Тест: клиент из конфигурации пишет файл в локальный HTTP-заглушку S3 (`com.sun.net.httpserver`), запрос `PutObject` без `x-amz-checksum-*`, `x-amz-trailer` и `Content-Encoding: aws-chunked`

## 2. Лог ошибки записи

- [x] 2.1 `S3PluginBuildStorage.putFile`: `WARN` с бакетом, ключом и сообщением SDK при `SdkException`, исключение пробрасывается дальше
- [ ] 2.2 Тест: заглушка S3 отвечает ошибкой, в логе (`ListAppender` logback, как в `TransactionDiagnosticsTest`) запись с бакетом и ключом, исключение доходит до вызывающего

## 3. Локальные проверки

- [x] 3.1 `JAVA_TOOL_OPTIONS=-Dapi.version=1.44 TESTCONTAINERS_RYUK_DISABLED=true ./gradlew :ds-service:buildAll :architecture-tests:test` в `backend-kt`, включая тесты публикации на MinIO
- [x] 3.2 `openspec validate fix-plugin-storage-s3-compatibility --strict`

## 4. Проверки до архивирования

- [ ] 4.1 [внешняя проверка] После выкладки ds-service на DEV `dsbuilder preview-plugin publish --platform compose --apply` и то же с `--platform react` отвечают `published`, файлы открываются по `Plugin URL`; при неудаче — ответ OBS из лога ds-service приложен к изменению
