//TODO: Вынести наконец в один файл и заменить везде на использование отсюда

export const camelToKebab = (str?: string) => {
    if (!str) {
        return '';
    }

    return str
        ?.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
        .toLowerCase();
};

export const kebabToCamel = (str?: string) => {
    if (!str) {
        return '';
    }

    return str?.replace(/-([a-z0-9])/g, (_, group) => {
        return group.toUpperCase();
    });
};
