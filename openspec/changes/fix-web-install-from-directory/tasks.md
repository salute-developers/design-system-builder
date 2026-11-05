## 1. Установщик

- [x] 1.1 `WebToolchainInstaller`: для `--from`, указывающего на каталог, `npm pack --json --pack-destination <prefix> <каталог>` с захватом вывода, имя архива из `filename`, затем установка получившегося `.tgz`; архив удаляется при любом исходе
- [x] 1.2 Тесты установщика с поддельным `ProcessRunner`: упаковка каталога и установка архива, ошибка `npm pack` с кодом, удаление архива, архив и реестр без изменений

## 2. Интеграционная проверка

- [x] 2.1 `js/cli/scripts/check-global-install.sh`: с путём к собранному `dsbuilder` распаковать архив из `npm pack` в каталог без `node_modules`, выполнить `dsbuilder toolchain install web --from <каталог>` с временным `HOME`, затем `dsbuilder-web-generator --version` и генерацию

## 3. Проверки

- [x] 3.1 `cd frontend-kt && ./gradlew :platform-web:jvmTest :platform-web:detekt :platform-web:spotlessCheck :cli:jvmTest`
- [x] 3.2 `check-global-install.sh` с путём к собранному `dsbuilder` проходит локально
- [x] 3.3 `openspec validate fix-web-install-from-directory --strict`
