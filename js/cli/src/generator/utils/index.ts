/** Scope генерируемого пакета, когда `NPM_PACKAGE_SCOPE` не задана. */
export const DEFAULT_NPM_PACKAGE_SCOPE = '@sddsjs';

/** Scope по правилам npm: `@`, затем строчные латинские буквы, цифры и `-._~`, не с точки или подчёркивания. */
const NPM_SCOPE_PATTERN = /^@[a-z0-9~-][a-z0-9._~-]*$/;

/**
 * Scope генерируемого пакета из `NPM_PACKAGE_SCOPE`; без неё или с пустым значением — `@sddsjs`.
 * Неверное значение — ошибка с именем переменной, чтобы генерация остановилась до записи файлов.
 */
export const resolveNpmPackageScope = (env: NodeJS.ProcessEnv = process.env): string => {
    const value = env.NPM_PACKAGE_SCOPE?.trim();
    if (!value) {
        return DEFAULT_NPM_PACKAGE_SCOPE;
    }
    if (!NPM_SCOPE_PATTERN.test(value)) {
        throw new Error(`NPM_PACKAGE_SCOPE must be an npm scope like ${DEFAULT_NPM_PACKAGE_SCOPE}, got "${value}"`);
    }
    return value;
};

export const CORE_VERSION = 'latest';

// TODO: вынести в общее место
export const lowerFirstLetter = (str: string) => {
    return str.charAt(0).toLocaleLowerCase() + str.slice(1);
};

// TODO: вынести в общее место
export const upperFirstLetter = (str: string) => {
    return str.charAt(0).toLocaleUpperCase() + str.slice(1);
};

export const kebabToCamel = (str: string) => {
    return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
};

export const camelToKebab = (str?: string) => {
    if (!str) {
        return '';
    }

    return str
        ?.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
        .toLowerCase();
};

export const indentedLine = (content: string, indentLevel = 0, indentSize = 4, indentChar = ' ') => {
    const indent = indentChar.repeat(indentLevel * indentSize);
    return indent + content;
};

export const getPlasmaConfigName = (componentName: string, coreConfigExport?: string | null) =>
    coreConfigExport || `${lowerFirstLetter(componentName)}Config`;

export const getPlasmaTokensName = (componentName: string, coreTokensExport?: string | null) =>
    coreTokensExport || `${lowerFirstLetter(componentName)}Tokens`;
