## 1. Клиент

- [x] 1.1 `schema.test.ts`: читать схему и фикстуры из `backend-kt/preview/contract` через `fs`; тест падает, если файлов нет.
- [x] 1.2 Удалить `src/composePreview/schema/`, `scripts/sync-preview-payload-schema.mjs`, скрипты `sync:preview-schema` и `check:preview-schema`.
- [x] 1.3 `README.md` клиента и `backend-kt/preview/contract/README.md`: убрать описание копии и скриптов.

## 2. CI

- [x] 2.1 `validate-js.yml`: задание `Tests (client)` (`npm ci`, `npm test` в `js/apps/client`).
- [x] 2.2 `validate-js.yml`: путь `backend-kt/preview/contract/**` запускает workflow.

## 3. Проверка

- [x] 3.1 `npm test` клиента проходит; испорченная схема или фикстура роняет `schema.test.ts`.
- [ ] 3.2 Задание CI проходит на ветке; правка только в `backend-kt/preview/contract` запускает workflow (проверяется после пуша).
