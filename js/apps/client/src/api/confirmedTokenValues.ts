import type { TokenDefinitionDto } from './editorContracts';

/** Та же форма платформенного значения для чтения и подтверждения записи. */
export const storedTokenValue = (type: TokenDefinitionDto['type'], value: unknown): unknown =>
    ['gradient', 'shadow'].includes(type)
        ? ([] as unknown[]).concat(value as never)
        : Array.isArray(value) && value.length === 1
          ? value[0]
          : value;
