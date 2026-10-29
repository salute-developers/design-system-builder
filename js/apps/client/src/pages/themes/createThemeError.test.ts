import { describe, expect, it } from 'vitest';

import { ApiError } from '../../shared/data/apiRequest';
import { getCreateThemeError } from './createThemeError';

describe('getCreateThemeError', () => {
    it('keeps the duplicate-name presentation contract', () => {
        expect(getCreateThemeError(new ApiError(409, 'TENANT_NAME_CONFLICT'))).toBe(
            'Theme с таким названием уже существует.',
        );
    });
});
