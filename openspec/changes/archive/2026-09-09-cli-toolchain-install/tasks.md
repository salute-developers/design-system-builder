## 1. Контракт установки

- [x] 1.1 Порт `ToolchainInstaller`, модель запроса и результата в `core-platform`
- [x] 1.2 Реестр установщиков и его регистрация в composition root

## 2. Команда

- [x] 2.1 `InstallToolchainUseCase` в `feature-toolchain`
- [x] 2.2 Команда `toolchain install <toolchain>` с `--version` и `--from`

## 3. Установщик iOS

- [x] 3.1 Разрешение релиза и ассета в GitHub Releases plasma-ios
- [x] 3.2 Распаковка в `~/.dsbuilder/toolchains/ios/<version>` и симлинк `current`
- [x] 3.3 Установка из локального архива по `--from`

## 4. Проверка

- [x] 4.1 Модульные тесты установщика и команды
- [x] 4.2 E2E: install → doctor → theme generate → docs generate на реальных бинарях
