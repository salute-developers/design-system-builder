import { beforeEach, describe, expect, it, vi } from 'vitest';

const http = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('./http', () => ({ http }));
vi.mock('./authService', () => ({
    authService: { getCurrentUser: () => ({ id: 'user' }), onSessionReset: () => undefined },
}));

import { componentStructureRepository as repository } from './componentStructureRepository';
import { tokenDefinitionsUrl } from './editorHttp';
import { invalidateEditorResources } from './editorReads';

const context = { projectId: 'p', designSystemId: 'ds', tenantId: 't' };
const tokens = (...items: Array<[string, string]>) => ({ data: items.map(([id, name]) => ({ id, name })) });
const sentTokenIds = () => http.put.mock.calls.map(([, body]) => (body as { tokenId: string | null }).tokenId);

// Настоящий кеш чтений редактора: справочник токенов читается с `freshFor`.
describe('componentStructureRepository: справочник токенов', () => {
    beforeEach(() => {
        Object.values(http).forEach((mock) => mock.mockReset());
        invalidateEditorResources([tokenDefinitionsUrl(context)]);
    });

    it('переиспользует справочник, пока токены не менялись', async () => {
        http.get.mockResolvedValue(tokens(['t-primary', 'text.default.primary']));

        await repository.setCombinationValue(context, 'a', ['s1', 's2'], 'color', '[text.default.primary]');
        await repository.setCombinationValue(context, 'a', ['s1', 's2'], 'background', '[text.default.primary]');

        expect(http.get).toHaveBeenCalledTimes(1);
        expect(sentTokenIds()).toEqual(['t-primary', 't-primary']);
    });

    it('перечитывает справочник, если выбранного токена в нём ещё нет', async () => {
        http.get.mockResolvedValueOnce(tokens(['t-primary', 'text.default.primary']));
        await repository.setCombinationValue(context, 'a', ['s1', 's2'], 'color', '[text.default.primary]');

        // Токен создан или переименован после того, как справочник попал в кеш.
        http.get.mockResolvedValueOnce(tokens(['t-primary', 'text.default.primary'], ['t-new', 'text.default.new']));
        await repository.setCombinationValue(context, 'a', ['s1', 's2'], 'color', '[text.default.new]');

        expect(http.get).toHaveBeenCalledTimes(2);
        expect(http.put).toHaveBeenLastCalledWith(
            expect.any(String),
            expect.objectContaining({ tokenId: 't-new', value: null }),
            expect.anything(),
        );
    });

    it('после адресного сброса берёт новый ID токена с тем же именем', async () => {
        http.get.mockResolvedValueOnce(tokens(['t-old', 'text.default.accent']));
        await repository.setCombinationValue(context, 'a', ['s1', 's2'], 'color', '[text.default.accent]');

        // Токен удалён и создан заново: `tokenRepository` сбрасывает справочник после записи определения.
        invalidateEditorResources([tokenDefinitionsUrl(context)]);
        http.get.mockResolvedValueOnce(tokens(['t-recreated', 'text.default.accent']));
        await repository.setCombinationValue(context, 'a', ['s1', 's2'], 'color', '[text.default.accent]');

        expect(sentTokenIds()).toEqual(['t-old', 't-recreated']);
    });
});
