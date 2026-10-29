let clientId: string | undefined;

/** Идентификатор экземпляра страницы, который не наследуется при дублировании вкладки. */
export const getEditorClientId = () => (clientId ??= crypto.randomUUID());
