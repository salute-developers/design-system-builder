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

export const transliterateToSnakeCase = (input: string) => {
    const map: Record<string, string> = {
        а: 'a',
        б: 'b',
        в: 'v',
        г: 'g',
        д: 'd',
        е: 'e',
        ё: 'yo',
        ж: 'zh',
        з: 'z',
        и: 'i',
        й: 'y',
        к: 'k',
        л: 'l',
        м: 'm',
        н: 'n',
        о: 'o',
        п: 'p',
        р: 'r',
        с: 's',
        т: 't',
        у: 'u',
        ф: 'f',
        х: 'h',
        ц: 'ts',
        ч: 'ch',
        ш: 'sh',
        щ: 'sch',
        ъ: '',
        ы: 'y',
        ь: '',
        э: 'e',
        ю: 'yu',
        я: 'ya',
    };

    return input
        .toLowerCase()
        .split('')
        .map((ch) => (map[ch] !== undefined ? map[ch] : ch))
        .join('')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
};

export const numberFormatter = (newValue: string, prevValue: string) => {
    const inputValue = newValue
        .replace(/[^\d.-]/g, '')
        .replace(/(?!^)-/g, '')
        .replace(/(\..*)\./g, '$1');

    if (['-', '.', '-.'].includes(inputValue)) {
        if (prevValue && prevValue.length > inputValue.length) {
            return '0';
        }

        return;
    }

    let value = parseFloat(inputValue).toString();

    if (inputValue.endsWith('.')) {
        value = inputValue;
    }

    if (inputValue === '' || isNaN(parseFloat(value))) {
        value = '0';
    }

    return value;
};
