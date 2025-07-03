import type { Meta } from '../../componentBuilder';
import type { ThemeSource } from '../../designSystem';

// INFO: у стоража ограничение на 5 мегабайт
export const saveDesignSystem = (data: {
    name: string;
    version: string;
    themeData: ThemeSource;
    componentsData: Meta[];
}) => {
    const { name, version, themeData, componentsData } = data;

    const key = `#${name}@${version}`;
    const value = JSON.stringify({
        themeData,
        componentsData,
    });

    localStorage.setItem(key, value);
};

export const loadDesignSystem = (
    name: string,
    version: string,
): { themeData: ThemeSource; componentsData: Meta[] } | undefined => {
    const savedDesignSystemData = localStorage.getItem(`#${name}@${version}`);
    return savedDesignSystemData ? JSON.parse(savedDesignSystemData) : undefined;
};

export const removeDesignSystem = (name: string, version: string) => {
    localStorage.removeItem(`#${name}@${version}`);
};

export const loadAllDesignSystemNames = (): (readonly [string, string])[] | undefined => {
    const themes = Object.keys(localStorage as unknown as Array<string>[number])
        .filter((key) => key.startsWith('#'))
        .map((item) => {
            const [name, version] = item.replace(`#`, '').split('@');

            return [name, version] as const;
        });

    return !themes.length ? undefined : themes;
};
