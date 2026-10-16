export const getComposePreviewPluginUrl = (): string | undefined => {
    const value = import.meta.env.VITE_COMPOSE_PREVIEW_PLUGIN_URL?.trim();

    return value || undefined;
};
