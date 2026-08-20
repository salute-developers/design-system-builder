import { FormulaMode } from './formulas';

export const DEFAULT_WHITE_COLOR = '#FFFFFFFF';
export const DEFAULT_BLACK_COLOR = '#000000FF';

export const baseColors = {
    white: {
        value: '#FFFFFF',
        comment: 'Базовый белый цвет',
    },
    black: {
        value: '#000000',
        comment: 'Базовый черный цвет',
    },
    clear: {
        value: '#FFFFFF00',
        comment: 'Базовый прозрачный цвет',
    },
};

// TODO: Подумать как сделать этот список динамическим, либо добавить механизм к группе
// который будет указывать как применять формулы для генерации active и hover состояний
export const sectionToFormulaMap: Record<string, FormulaMode> = {
    text: 'text',
    outline: 'stroke',
    surface: 'fill',
    data: 'fill',
};

export const grayTones = [
    { value: 'gray', label: 'Без примесей' },
    { value: 'warmGray', label: 'Тёплый' },
    { value: 'coolGray', label: 'Холодный' },
];
