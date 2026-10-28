import { readEditor } from './editorReads';
import { apiRoot, readRequest, variationReadRequest } from './editorHttp';
import type { AppearanceDto, ComponentDto, EditorContextKey } from './editorContracts';

export interface JournalComponentMetadata {
    componentNames: Record<string, string>;
    referenceNames: Record<string, string>;
}

/** Плоские имена для журнала: пять пакетных чтений метаданных, без экспортов/значений конфигураций. */
export async function loadJournalComponentMetadata(
    context: EditorContextKey,
    signal?: AbortSignal,
): Promise<JournalComponentMetadata> {
    const root = apiRoot(context.projectId);
    const request = readRequest(context, signal);
    type NamedOwner = { id: string; name: string; componentId: string | null };
    type NamedStyle = { id: string; name: string; variationId: string; designSystemId: string };
    const [components, appearances, properties, variations, styles] = await Promise.all([
        readEditor<ComponentDto[]>(`${root}/components`, request),
        readEditor<AppearanceDto[]>(`${root}/design-systems/${context.designSystemId}/appearances`, request),
        readEditor<NamedOwner[]>(`${root}/properties`, request),
        readEditor<NamedOwner[]>(`${root}/variations`, variationReadRequest(context, signal)),
        readEditor<NamedStyle[]>(`${root}/styles`, request),
    ]);
    const componentNames = Object.fromEntries(components.data.map((item) => [item.id, item.name]));
    const referenceNames: Record<string, string> = {};
    for (const item of [...appearances.data, ...properties.data, ...variations.data]) {
        if (item.name) referenceNames[item.id] = item.name;
        if (item.componentId && componentNames[item.componentId])
            componentNames[item.id] = componentNames[item.componentId];
    }
    for (const item of styles.data.filter((style) => style.designSystemId === context.designSystemId)) {
        referenceNames[item.id] = item.name;
        if (componentNames[item.variationId]) componentNames[item.id] = componentNames[item.variationId];
    }
    return { componentNames, referenceNames };
}
