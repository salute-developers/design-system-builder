## 1. Scope генерируемого пакета (js/cli)

- [x] 1.1 В `js/cli/src/generator/utils/index.ts` ввести `DEFAULT_NPM_PACKAGE_SCOPE = '@sddsjs'` и `resolveNpmPackageScope(env)`: пустое значение даёт `@sddsjs`, значение не по правилам npm даёт ошибку с именем и значением переменной до записи файлов
- [x] 1.2 Тесты `resolveNpmPackageScope`: без переменной, пустая строка, `@acme`, неверные значения; тест генерации `--package --name base` без `NPM_PACKAGE_SCOPE` даёт `@sddsjs/base`
- [x] 1.3 Обновить `js/cli/README.md` и корневой `README.md`: переменная необязательна, пример переопределения

## 2. npm-пакет и исполняемый файл (js/cli)

- [x] 2.1 Точки входа `src/theme.ts`, `src/components.ts`, `src/ds.ts` экспортируют `main(argv)` и запускают её сами только при прямом вызове; `npm run generate:*` работает как раньше
- [x] 2.2 Добавить `js/cli/bin/dsbuilder-web-generator.js`: регистрация `tsx`, подкоманды `theme`, `components`, `ds`, `--version` из `package.json`, список подкоманд и ненулевой код для неизвестной подкоманды
- [x] 2.3 `package.json`: имя `@sddsjs/design-system-builder-generator`, `version` `0.1.0`, `bin`, `files` (без тестов), `engines.node >=22`, `publishConfig.access public`, `prepublishOnly` с проверкой типов и тестами; перенести в `dependencies` модули, которые генератор импортирует при работе, включая `tsx`; обновить `package-lock.json`
- [x] 2.4 Тесты исполняемого файла: `--version`, неизвестная подкоманда, `ds --sdds <тестовые данные> --out <tmp>` совпадает с `generate:ds`
- [x] 2.5 Проверка упаковки: `npm pack`, установка архива в отдельный prefix (`npm install -g --prefix <tmp>`), запуск `dsbuilder-web-generator ds` из постороннего каталога без `js/.env`; оформить как скрипт проверки в `js/cli`
- [x] 2.6 Обновить ссылки на старое имя пакета в репозитории (`js/package.json`, `js/CLAUDE.md`, README, `frontend-kt`)

## 3. Публикация в npm

- [x] 3.1 Описать ручную публикацию генератора в `js/cli/README.md`: подъём `version`, `npm publish`, проверка `npm pack --dry-run`, порядок относительно выпуска CLI

## 4. Делегат web (frontend-kt/platform-web)

- [x] 4.1 `WebToolLocator`: порядок `--tool`, `DSBUILDER_WEB_TOOL`, `dsbuilder-web-generator` в `PATH` (`.cmd` на Windows), bin-каталог `npm prefix -g`; результат `WebToolLookup` с подсказками для каждого случая отсутствия
- [x] 4.2 `WebNpmDelegate`: запуск `dsbuilder-web-generator <theme|components|ds>` в рабочей копии для глобальной установки, прежний `npm run` для каталога; `doctor` для глобальной установки печатает путь и `--version`
- [x] 4.3 Обновить KDoc делегата, локатора и `webPlatformModule`
- [x] 4.4 Тесты `WebNpmDelegateTest` с поддельным `ProcessRunner`: глобальный запуск всех трёх capability, приоритет явного пути, неверный `DSBUILDER_WEB_TOOL` без перехода к глобальной установке, поиск через `npm prefix -g`, Windows-пути и `.cmd`, подсказка при отсутствии с `dsbuilder toolchain install web`

## 5. Установщик toolchain web

- [x] 5.1 `WebToolchainInstaller` в `platform-web`: `npm install -g` для `@latest`, `--version` и `--from`; версия из `dsbuilder-web-generator --version`; ошибки без `npm` и с кодом npm и подсказкой про права
- [x] 5.2 Зарегистрировать установщик в `toolchainInstallers()` `:cli` для JVM, macOS и Windows; обновить help `toolchain install`
- [x] 5.3 Тесты установщика с поддельным `ProcessRunner` и тест `toolchain install web` через `DsBuilderCli`

## 6. Установщики дистрибутивов

- [x] 6.1 `install-unix-common.sh`: после установки CLI вызвать `dsbuilder toolchain install web`, без `npm` или при ошибке печатать предупреждение и команду повтора, код 0; флаг `--without-web`
- [x] 6.2 `install-macos-cli.sh` и `install-jvm-cli.sh`: разбор `--without-web` вместе с `--without-ios` в любом порядке
- [x] 6.3 `install-windows-cli.ps1`: тот же шаг и параметр `-WithoutWeb`
- [x] 6.4 Сетевые `bootstrap/install.sh` и `bootstrap/install.ps1`: принимать и передавать `--without-web` / `-WithoutWeb`
- [x] 6.5 Smoke-проверки `publish-cli-release.yml` ставят CLI с `--without-web`
- [x] 6.6 Тесты `cli/distribution/tests`: поддельный `npm` в `PATH` (успех, ошибка), отсутствие `npm`, флаг отказа, сочетание с `--without-ios`; Windows-тесты в `install-windows.Tests.ps1`

## 7. Документация

- [x] 7.1 `frontend-kt/cli/USAGE.md`: требования (Node.js 22+ и npm для React, Java 17+ для JVM-сборки), установка генератора вместе с CLI и через `dsbuilder toolchain install web`, переопределение `NPM_PACKAGE_SCOPE`, работа из репозитория через `DSBUILDER_WEB_TOOL`
- [x] 7.2 `frontend-kt/README.md`, `frontend-kt/AGENTS.md` (описание `platform-web`) и `frontend-kt/cli/distribution/README.md`

## 9. Установка генератора в каталог пользователя

- [x] 9.1 `WebToolchainInstaller`: `npm install --global --prefix ~/.dsbuilder/toolchains/web <spec>`; домашний каталог из `HOME`, на Windows из `USERPROFILE`; сообщение об ошибке npm без совета менять глобальный prefix
- [x] 9.2 `WebToolLocator`: управляемая установка (`<prefix>/bin/dsbuilder-web-generator`, на Windows `<prefix>\dsbuilder-web-generator.cmd`) после явного каталога и до `PATH`
- [x] 9.3 Тесты локатора, делегата и установщика: аргументы npm с `--prefix`, приоритет управляемой установки над `PATH`, Windows-пути, отсутствие домашнего каталога
- [x] 9.4 Документация: `USAGE.md`, README `js/cli`, `frontend-kt/AGENTS.md`, `cli/distribution/README.md`
- [x] 9.5 Ручная проверка на macOS с системным Node.js (глобальный каталог npm принадлежит root): `./install-local-cli.sh` ставит генератор без ошибок, `dsbuilder toolchain doctor --platform react` — ready

## 8. Проверки

- [x] 8.1 `cd js && npm run test:cli` и `cd js && npm run build`
- [x] 8.2 Проверка упаковки из задачи 2.5 проходит локально
- [x] 8.3 `cd frontend-kt && ./gradlew build` (включая detekt, spotless и `:cli:distributionTests`)
- [x] 8.4 Ручная проверка на macOS: установленный локальный `dsbuilder` с глобально установленным из `npm pack` генератором выполняет `dsbuilder ds generate --platform react -- --package --name base` без `DSBUILDER_WEB_TOOL` и без `NPM_PACKAGE_SCOPE`, пакет называется `@sddsjs/base`
- [x] 8.5 `openspec validate web-generator-npm-global --strict`
- [x] 8.6 [внешняя проверка] Пользователь вручную опубликовал пакет: `npm view @sddsjs/design-system-builder-generator version` возвращает `0.1.0`
- [ ] 8.7 [внешняя проверка] Workflow `validate-frontend-kt` и `validate-js` в PR зелёные, включая Windows-сборку
