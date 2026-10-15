import type { HostDefaults } from './draft';

/**
 * Стили и текст по умолчанию, которые Android-песочница задаёт вокруг историй (`SandboxTheme`: `LocalButtonStyle`,
 * `LocalSwitchStyle`, `LocalSpinnerStyle`, `ProvideTextStyle`). Значения берутся из темы дизайн-системы: ссылки на стили
 * (`<конфигурация>.<стили>`) разворачиваются по её конфигурациям, токены ищутся в её теме. Чего нет в дизайн-системе,
 * в payload не попадает, и плагин оставляет значения библиотеки.
 */
export const COMPOSE_HOST_DEFAULTS: HostDefaults = {
    text: { style: 'body.m.normal', color: 'text.default.primary' },
    styles: { button: 'basic-button.m.default', switch: 'switch.s', spinner: 'spinner.xs.default' },
};
