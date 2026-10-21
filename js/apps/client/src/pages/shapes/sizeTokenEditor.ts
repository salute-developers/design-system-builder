import {
    notifySession,
    reloadSizeTokens,
    tokenSaveStatus,
    tokenValue,
    withValue,
    type CreateSizeTokenRequest,
    type SizeToken,
    type SizeTokenSession,
    type SizeTokenValue,
} from '../../modules/sizeTokens';

/** Редактор раздела: правки ставятся в очередь автосохранения, ответы операций обновляют раздел и модель темы. */
export const createSizeTokenEditor = (session: SizeTokenSession) => {
    const saved = (tokenId: string) => session.data?.tokens.find((token) => token.tokenId === tokenId) ?? null;
    /** Опубликованная версия доступна только для чтения: изменяющие запросы не отправляются. */
    const readOnly = () => Boolean(session.context.versionId);

    return {
        /** Токены с несохранёнными значениями — то, что видно в инспекторе. */
        tokens(): SizeToken[] {
            return (session.data?.tokens ?? []).map((token) => withValue(token, session.edits.get(token.tokenId)));
        },

        /**
         * Токены для дерева и борда: значение, отклонённое проверкой сервера, не показывается — там остаётся
         * последнее сохранённое.
         */
        shownTokens(): SizeToken[] {
            return (session.data?.tokens ?? []).map((token) =>
                session.rejected.has(token.tokenId) ? token : withValue(token, session.edits.get(token.tokenId)),
            );
        },

        /** Текущее значение токена с несохранёнными правками. */
        value(tokenId: string): SizeTokenValue | null {
            const token = saved(tokenId);
            return session.edits.get(tokenId) ?? (token ? tokenValue(token) : null);
        },

        status: (tokenId: string) => tokenSaveStatus(session, tokenId),

        /** Новое значение токена из текущего: правка ставится в очередь автосохранения. */
        update(tokenId: string, change: (value: SizeTokenValue) => SizeTokenValue) {
            if (readOnly()) return;
            const current = this.value(tokenId);
            if (!current) return;
            session.edits.set(tokenId, change(current));
            session.rejected.delete(tokenId);
            session.autosave.schedule(tokenId, () => {
                const value = session.edits.get(tokenId);
                return value ? { type: 'update', tokenId, value } : null;
            });
            notifySession(session);
        },

        /** Создаёт радиус, отступ или размер тени после отправки очереди. */
        async create(request: CreateSizeTokenRequest): Promise<SizeToken[]> {
            if (readOnly()) return [];
            const result = await session.autosave.run({ type: 'create', request });
            return result.type === 'create' ? result.created : [];
        },

        /** Удаляет токен (у тени — размер целиком) после отправки очереди. */
        async remove(token: SizeToken) {
            if (readOnly()) return;
            await session.autosave.run({ type: 'delete', tokenId: token.tokenId });
        },

        /** «Повторить»: отправляет операцию сразу, не дожидаясь автоматического повтора. */
        retry(tokenId?: string) {
            session.autosave.retry(tokenId);
        },

        reload: () => reloadSizeTokens(session),
    };
};

export type SizeTokenEditor = ReturnType<typeof createSizeTokenEditor>;
