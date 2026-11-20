/** Адрес gateway выбирается режимом сборки; в Figma `networkAccess` манифеста разрешает только эти адреса. */
const GATEWAYS: Record<string, string> = {
    development: 'http://localhost:8080',
    stand: 'https://gateway-dev.design-system-builder.ru',
    // Шлюз Yandex Cloud перед боевым gateway: его пропускают корпоративные сети, где домен gateway закрыт.
    yandex: 'https://d5dudn29fhuoodkn4tik.iwzqm34r.apigw.yandexcloud.net',
};

export const GATEWAY_URL = GATEWAYS[import.meta.env.MODE] ?? 'https://gateway.design-system-builder.ru';

export const CLIENT_ID = 'dsbuilder-figma-plugin';

export const REALM = 'dsbuilder';
