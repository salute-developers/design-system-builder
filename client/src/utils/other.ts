export const getFormatDate = (date: string) => {
    const newDate = new Date(date);
    const formatter = new Intl.DateTimeFormat('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

    return formatter.format(newDate).replace(/,/, '');
};

export const inRange = (x: number, [from, to]: number[]) => x >= from && x <= to;

export const isCamelCaseNotation = (value: string) => RegExp(/^[A-Z][a-z0-9]*(?:[A-Z][a-z0-9]+)*$/).test(value);

export const isHEXFormat = (value: string) => RegExp(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/).test(value);

export const prettifyColorName = (input: string) => {
    const words = input.replace(/([a-z])([A-Z])/g, '$1 $2');
    return words
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

export const h6 = {
    'font-family': 'SB Sans Display',
    'font-size': '12px',
    'font-style': 'normal',
    'font-weight': '400',
    'line-height': '16px',
};

export const roundTo = (num: number, precision = 2) => {
    return (Math.round(num * 100) / 100).toFixed(precision);
};
