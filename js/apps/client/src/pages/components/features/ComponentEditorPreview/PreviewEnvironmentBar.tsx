import type { ReactNode } from 'react';

import type { SegmentButtonItem, SelectButtonItem } from '../../../../components';
import type { PreviewView } from '../../../../composePreview';
import { TyGlyph } from '../../../typography/ui/TyGlyph';
import { WorkbenchMenu } from '../../ui/WorkbenchMenu';

export type PreviewPlatform = 'web' | 'compose';

export interface PreviewPlatformOption {
    platform: PreviewPlatform;
    /** Компонент с тем же именем на этой платформе; без него пункт недоступен. */
    available: boolean;
}

const PLATFORM_LABELS: Record<PreviewPlatform, string> = { web: 'Web', compose: 'Compose' };

interface PreviewEnvironmentBarProps {
    title: string;
    /** Индикатор автосохранения перед контролами. */
    status?: ReactNode;
    platform: PreviewPlatform;
    platforms: PreviewPlatformOption[];
    onPlatformSelect: (platform: PreviewPlatform) => void;
    /** Виды контейнера превью, как у `ViewContainer` plasma. */
    views: PreviewView[];
    view: PreviewView;
    onViewSelect: (view: PreviewView) => void;
    themeMode: SegmentButtonItem;
    themeModes: SegmentButtonItem[];
    onThemeModeSelect: (item: SegmentButtonItem) => void;
    /** Выбор рендерера web-компонента с Compose-метаданными; без вариантов не показывается. */
    renderers?: { items: SelectButtonItem[]; selected: SelectButtonItem; onSelect: (item: SelectButtonItem) => void };
}

/** Панель над холстом превью: заголовок сочетания, платформа, вид контейнера и тема. */
export const PreviewEnvironmentBar = (props: PreviewEnvironmentBarProps) => {
    const { title, platform, platforms, view, themeMode, themeModes, renderers } = props;
    const dark = themeMode.value === 'dark';
    const nextMode = themeModes.find((item) => item.value !== themeMode.value) ?? themeMode;

    return (
        <header className="component-preview-environment-bar">
            <h2 className="component-preview-title" aria-live="polite">
                {title}
            </h2>
            <div className="component-preview-context-controls">
                {props.status}
                {renderers && renderers.items.length > 1 && (
                    <WorkbenchMenu
                        className="component-environment-menu has-text"
                        label={`Рендерер: ${renderers.selected.label}`}
                        title="Рендерер"
                        trigger={
                            <>
                                <span className="component-environment-text">{renderers.selected.label}</span>
                                <TyGlyph name="chevron-down" />
                            </>
                        }
                        items={renderers.items.map((item) => ({
                            key: String(item.value),
                            label: String(item.label),
                            checked: item.value === renderers.selected.value,
                            onSelect: () => renderers.onSelect(item),
                        }))}
                    />
                )}
                <WorkbenchMenu
                    className="component-environment-menu"
                    label={`Платформа: ${PLATFORM_LABELS[platform]}`}
                    title="Платформа"
                    trigger={
                        <>
                            <TyGlyph name={platform} />
                            <TyGlyph name="chevron-down" />
                        </>
                    }
                    items={platforms.map((option) => ({
                        key: option.platform,
                        label: PLATFORM_LABELS[option.platform],
                        icon: <TyGlyph name={option.platform} />,
                        checked: option.platform === platform,
                        disabled: !option.available,
                        onSelect: () => props.onPlatformSelect(option.platform),
                    }))}
                />
                <WorkbenchMenu
                    className="component-environment-menu"
                    label={`Вид: ${view}`}
                    title="Вид контейнера"
                    trigger={
                        <>
                            <TyGlyph name="layers" />
                            <TyGlyph name="chevron-down" />
                        </>
                    }
                    items={props.views.map((item) => ({
                        key: item,
                        label: item,
                        checked: item === view,
                        onSelect: () => props.onViewSelect(item),
                    }))}
                />
                <button
                    type="button"
                    className="component-theme-toggle"
                    role="switch"
                    aria-label="Тёмная тема"
                    aria-checked={dark}
                    title={`Переключить на ${dark ? 'светлую' : 'тёмную'} тему`}
                    onClick={() => props.onThemeModeSelect(nextMode)}
                >
                    <TyGlyph name={dark ? 'moon' : 'sun'} />
                </button>
            </div>
        </header>
    );
};
