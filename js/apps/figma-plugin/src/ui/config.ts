/** Адрес gateway выбирается при сборке; `networkAccess` манифеста разрешает только эти адреса. */
export const GATEWAY_URL =
    import.meta.env.MODE === 'development' ? 'http://localhost:8080' : 'https://gateway.design-system-builder.ru';

export const CLIENT_ID = 'dsbuilder-figma-plugin';

export const REALM = 'dsbuilder';
