/**
 * Правила, по которым генератор переводит конфигурацию компонентов в web-параметры ядра и переменные темы.
 * Чистые функции без Node.js и без импорта ядра: их можно вызывать и вне генератора.
 */
export * from './api-meta.ts';
export * from './core-exports.ts';
export * from './theme-variables.ts';
export * from './typography.ts';
export * from './units.ts';
export * from './web-adapter.ts';
