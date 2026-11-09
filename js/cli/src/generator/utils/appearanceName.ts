/**
 * Имя конфигурации компонента в данных — kebab-case (`default`, `clear-action`): оно же значение пропа `appearance`.
 * Для файлов, переменных и экспортов генератор строит из него camelCase-идентификатор.
 */
const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** Ключ объекта для значения `appearance`: идентификатор как есть, иначе строка в кавычках. */
export const appearanceKey = (name: string) => (/^[a-z][a-z0-9]*$/.test(name) ? name : `'${name}'`);

/**
 * camelCase-идентификатор конфигурации: `clear-action` → `clearAction`. Имя не в kebab-case генератор не угадывает:
 * генерация останавливается с ошибкой, называющей компонент и конфигурацию.
 */
export const appearanceIdentifier = (componentName: string, name: string) => {
    if (!KEBAB_CASE.test(name)) {
        throw new Error(
            `Компонент ${componentName}: имя конфигурации «${name}» не в kebab-case. ` +
                'Переименуйте конфигурацию в редакторе: строчные латинские буквы и цифры через дефис.',
        );
    }
    return name.replace(/-([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());
};

/** Файл конфига темы без расширения: `default` — `<Компонент>.config`, остальные — `<Компонент>.<идентификатор>.config`. */
export const appearanceConfigFile = (componentName: string, name: string) =>
    name === 'default' ? `${componentName}.config` : `${componentName}.${appearanceIdentifier(componentName, name)}.config`;
