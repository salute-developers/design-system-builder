import type { Meta } from '../../componentBuilder';
import type { ThemeSource } from '../../designSystem';

// INFO: у стоража ограничение на 5 мегабайт
export const saveDesignSystem = async (data: {
    name: string;
    version: string;
    themeData: ThemeSource;
    componentsData: Meta[];
}): Promise<void> => {
    const { name, version, themeData, componentsData } = data;

    const key = `#${name}@${version}`;
    const value = JSON.stringify({
        themeData,
        componentsData,
    });

    return Promise.resolve(localStorage.setItem(key, value));
};

export const loadDesignSystem = async (
    name: string,
    version: string,
): Promise<{ themeData: ThemeSource; componentsData: Meta[] } | undefined> => {
    const savedDesignSystemData = localStorage.getItem(`#${name}@${version}`);
    return Promise.resolve(savedDesignSystemData ? JSON.parse(savedDesignSystemData) : undefined);
};

export const removeDesignSystem = async (name: string, version: string): Promise<void> => {
    return Promise.resolve(localStorage.removeItem(`#${name}@${version}`));
};

export const loadAllDesignSystemNames = async (): Promise<(readonly [string, string])[] | undefined> => {
    const themes = Object.keys(localStorage as unknown as Array<string>[number])
        .filter((key) => key.startsWith('#'))
        .map((item) => {
            const [name, version] = item.replace(`#`, '').split('@');

            return [name, version] as const;
        });

    return Promise.resolve(!themes.length ? undefined : themes);
};
