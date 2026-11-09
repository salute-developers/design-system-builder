import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { useComponentData } from '../../../../hooks';
import { DesignSystem, Config, Theme } from '../../../../controllers';
import { SegmentButtonItem } from '../../../../components';
import { ComponentEditorPreview, type StoryArgs } from '../ComponentEditorPreview';
import type { PreviewPlatform, PreviewPlatformOption } from '../ComponentEditorPreview/PreviewEnvironmentBar';
import { ComponentInspector, combinationTitle } from '../ComponentInspector';
import type { StructureAccess } from '../ComponentStructure';

import { Root } from './ComponentEditor.styles';
import { componentPreviewRequest, modeList, resolveComponentPreview } from './ComponentEditor.utils';

interface ComponentEditorProps {
    designSystem: DesignSystem;
    theme: Theme;
    configs?: Config[];
    updated: object;
    /** Платформы компонента для меню панели окружения превью. */
    platforms: PreviewPlatformOption[];
    onPlatformSelect: (platform: PreviewPlatform) => void;
    onConfigUpdate: () => void;
    /** Выбор открытой конфигурации компонента. */
    onConfigurationSelect?: (configurationId: string | undefined) => void;
    /** Структурные операции вкладки «Структура»; без них вкладки нет. */
    structure?: StructureAccess;
}

export const ComponentEditor = (props: ComponentEditorProps) => {
    const { designSystem, theme, configs, updated, platforms, onPlatformSelect, onConfigUpdate } = props;
    const { onConfigurationSelect, structure } = props;

    const config = configs?.[0];

    // Сочетание вариаций: имя вариации → id стиля. Его рисует превью и редактирует инспектор.
    const [selection, setSelection] = useComponentData(config);
    // Аргументы story: значения живут в превью, инспектор показывает их в «Variants».
    const [storyArgs, setStoryArgs] = useState<StoryArgs>();

    const location = useLocation();
    const preview = useMemo(() => componentPreviewRequest(location.state), [location.state]);
    const [themeMode, setThemeMode] = useState<SegmentButtonItem>(
        () => modeList.find((item) => item.value === preview?.mode) ?? modeList[0],
    );

    // INFO: Переход из «Доступности» цветовых токенов открывает вариацию и стиль пары. Эффект объявлен после
    // `useComponentData` и применяется поверх значений по умолчанию, которые хук выставляет при загрузке.
    useEffect(() => {
        const target = config && preview ? resolveComponentPreview(config, preview) : undefined;
        if (!target) {
            return;
        }
        setSelection((current) => ({ ...current, [target.variationName]: target.styleID }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config, preview]);
    // Стабильная ссылка: от неё зависит пересборка payload Compose-превью.
    const resolveStyleReference = useCallback(
        (reference: string) => designSystem.resolveComposeStyleReference(reference),
        [designSystem],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const relatedConfigs = useMemo(() => new Map<string, Config>(), [designSystem, updated]);

    // INFO: Выключенный флаг (`pilled`) и вариация без стиля — отсутствие аргумента, а не значение.
    const onSelectionChange = useCallback(
        (name: string, styleID: string | undefined) =>
            setSelection((current) => {
                const next = { ...current };
                if (styleID === undefined) delete next[name];
                else next[name] = styleID;
                return next;
            }),
        [setSelection],
    );

    if (!config) {
        return null;
    }

    return (
        <Root className="component-workbench">
            <ComponentEditorPreview
                theme={theme}
                config={config}
                args={selection}
                designSystem={designSystem}
                relatedConfigs={relatedConfigs}
                themeModeList={modeList}
                themeMode={themeMode}
                onUpdateThemeMode={setThemeMode}
                title={combinationTitle(config, selection)}
                platforms={platforms}
                onPlatformSelect={onPlatformSelect}
                resolveStyleReference={resolveStyleReference}
                onStoryArgsChange={setStoryArgs}
            />
            <ComponentInspector
                config={config}
                designSystem={designSystem}
                theme={theme}
                updated={updated}
                selection={selection}
                themeMode={themeMode.value === 'light' ? 'light' : 'dark'}
                onSelectionChange={onSelectionChange}
                onConfigUpdate={onConfigUpdate}
                storyArgs={storyArgs}
                onConfigurationSelect={onConfigurationSelect}
                structure={structure}
            />
        </Root>
    );
};
