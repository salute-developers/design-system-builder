const SizesOrder = ["xxl", "xl", "l", "m", "s", "xs", "xxs"];

const NonExistSizeOrder = SizesOrder.length;

export const Views: Record<string, string> = {
    default: "по-умолчанию",
    accent: "акцентная",
    primary: "основная",
    secondary: "вторичная",
    clear: "без цветового сопровождения",
    success: "успешное завершение",
    warning: "предупреждение",
    critical: "ошибка",
    dark: "темная",
    black: "черная",
    white: "белая",
};

export const dataFormatter = ({ value }: any) => value.replace(/"/g, "");

export const sortPredicate = (a: any, b: any) => {
    const aIndex = SizesOrder.indexOf(a);
    const bIndex = SizesOrder.indexOf(b);

    return (
        (aIndex === -1 ? NonExistSizeOrder : aIndex) -
        (bIndex === -1 ? NonExistSizeOrder : bIndex)
    );
};

/**
 * Извлекает имя компонента из URL страницы документации
 *
 * @example
 * // URL: /components/button/ или /dev/sdds-finai/components/button/
 * getComponentNameFromUrl('/components/button/') // 'Button'
 * getComponentNameFromUrl('/dev/sdds-finai/components/button/') // 'Button'
 * getComponentNameFromUrl('/components/radio-box/') // 'RadioBox'
 *
 * @param pathname - путь из location.pathname
 * @returns Имя компонента с заглавной буквы или undefined
 */
export const getComponentNameFromUrl = (pathname: string): string | undefined => {
    // Удаляем trailing slash и split по /
    const parts = pathname.replace(/\/$/, '').split('/');

    const componentsIndex = parts.findIndex(part => part === 'components');

    if (componentsIndex === -1 || componentsIndex === parts.length - 1) {
        return undefined;
    }

    const componentSlug = parts[componentsIndex + 1];

    if (!componentSlug) {
        return undefined;
    }

    return componentSlug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
};

/**
 * Хук для получения имени компонента из текущего URL
 * Использует Docusaurus router
 */
export const useComponentNameFromUrl = (): string | undefined => {
    if (typeof window === 'undefined') {
        return undefined;
    }

    return getComponentNameFromUrl(window.location.pathname);
};
