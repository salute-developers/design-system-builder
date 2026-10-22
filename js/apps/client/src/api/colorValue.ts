/** Раскрывает ошибочно сериализованный HEX/ссылку, не меняя произвольные текстовые значения токенов. */
export const normalizedColorValue = <T>(value: T): T => {
    if (Array.isArray(value)) return value.map(normalizedColorValue) as T;
    if (typeof value !== 'string' || !value.trimStart().startsWith('"')) return value;
    try {
        const decoded: unknown = JSON.parse(value);
        if (
            typeof decoded === 'string' &&
            /^(?:#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})|\[(?:general|additional)\.[\w]+\.\d+\](?:\[\d+(?:\.\d+)?\])?)$/i.test(
                decoded,
            )
        )
            return decoded as T;
    } catch {
        // Не JSON: исходный текст остаётся неизменным.
    }
    return value;
};
