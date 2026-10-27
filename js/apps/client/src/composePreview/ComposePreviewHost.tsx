import { createContext, ReactNode, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { ComposePreviewFrame, ComposePreviewFrameProps } from './ComposePreviewFrame';
import { HostLayer, SlotRoot } from './ComposePreviewHost.styles';
import type { PreviewComponentDescription, PreviewPayloadInput } from './types';

/** Что область превью просит показать в общем iframe плагина. */
export interface ComposePreviewHostRequest {
    /** Получатель кадра: область превью конкретного компонента. Смена получателя скрывает прежний кадр до `success`. */
    owner: string;
    /** Без payload область показывает состояние загрузки. */
    payload?: PreviewPayloadInput;
    onDescription?: (description: PreviewComponentDescription) => void;
    onDescriptionError?: (error: Error) => void;
}

/**
 * Хост Compose-плагина раздела компонентов: одна сессия и один iframe на раздел. Область превью отдаёт ему свой узел,
 * и iframe позиционируется над ним; сам iframe в DOM не переносится, иначе браузер загрузил бы плагин заново.
 */
export interface ComposePreviewHost {
    /** Показывает iframe над `slot` и отправляет payload (и `describe` при смене компонента) в общую сессию. */
    render(request: ComposePreviewHostRequest, slot: HTMLElement): void;
    /** Скрывает iframe, если его сейчас показывает `owner`. Сессия и iframe остаются. */
    hide(owner: string): void;
}

const ComposePreviewHostContext = createContext<ComposePreviewHost | undefined>(undefined);

/** Хост раздела; `undefined` вне раздела или когда адреса плагина нет. */
export const useComposePreviewHost = () => useContext(ComposePreviewHostContext);

type FrameOptions = Pick<ComposePreviewFrameProps, 'timeoutMs' | 'loadManifest' | 'createSession'>;

interface ComposePreviewHostProviderProps extends FrameOptions {
    /** Адрес плагина; без него хоста нет. Смена адреса уничтожает сессию и iframe. */
    pluginUrl?: string;
    /** Контекст дизайн-системы: при смене сессия и iframe создаются заново. */
    scope?: string;
    /** Запустить плагин сразу, до первой области превью: у дизайн-системы есть Compose-компоненты. */
    preload?: boolean;
    children: ReactNode;
}

interface ActiveRequest {
    request: ComposePreviewHostRequest;
    slot: HTMLElement;
}

export const ComposePreviewHostProvider = ({
    pluginUrl,
    scope = '',
    preload = false,
    children,
    ...frameOptions
}: ComposePreviewHostProviderProps) => {
    const [active, setActive] = useState<ActiveRequest>();
    const layerKey = `${scope}\n${pluginUrl ?? ''}`;
    const layerKeyRef = useRef(layerKey);
    layerKeyRef.current = layerKey;
    // Без предзагрузки плагин запускается при первой области превью и дальше живёт до смены контекста.
    const [requestedKey, setRequestedKey] = useState<string>();

    const host = useMemo<ComposePreviewHost>(
        () => ({
            render: (request, slot) => {
                setActive({ request, slot });
                setRequestedKey(layerKeyRef.current);
            },
            hide: (owner) => setActive((current) => (current?.request.owner === owner ? undefined : current)),
        }),
        [],
    );

    return (
        <ComposePreviewHostContext.Provider value={pluginUrl ? host : undefined}>
            {children}
            {pluginUrl && (preload || requestedKey === layerKey) && (
                <ComposePreviewHostFrame key={layerKey} pluginUrl={pluginUrl} active={active} {...frameOptions} />
            )}
        </ComposePreviewHostContext.Provider>
    );
};

interface ComposePreviewHostFrameProps extends FrameOptions {
    pluginUrl: string;
    active?: ActiveRequest;
}

const ComposePreviewHostFrame = ({ pluginUrl, active, ...frameOptions }: ComposePreviewHostFrameProps) => {
    const layerRef = useRef<HTMLDivElement>(null);
    const activeRef = useRef(active);
    activeRef.current = active;
    const slot = active?.slot;

    // Описание приходит тому, кто сейчас владеет областью: устаревшие ответы отсекает сам ComposePreviewFrame.
    const onDescription = useCallback(
        (description: PreviewComponentDescription) => activeRef.current?.request.onDescription?.(description),
        [],
    );
    const onDescriptionError = useCallback(
        (error: Error) => activeRef.current?.request.onDescriptionError?.(error),
        [],
    );

    useLayoutEffect(() => {
        const layer = layerRef.current;
        if (!layer) return;
        // Скрытый iframe недоступен с клавиатуры и для вспомогательных технологий.
        if (slot) layer.removeAttribute('inert');
        else layer.setAttribute('inert', '');
        if (!slot) return;

        return followSlot(layer, slot);
    }, [slot]);

    return (
        <HostLayer ref={layerRef} data-testid="compose-preview-host" $visible={Boolean(slot)} aria-hidden={!slot}>
            <ComposePreviewFrame
                pluginUrl={pluginUrl}
                payload={active?.request.payload}
                subscriber={active?.request.owner}
                onDescription={onDescription}
                onDescriptionError={onDescriptionError}
                {...frameOptions}
            />
        </HostLayer>
    );
};

const CLIPPING_OVERFLOW = /(auto|scroll|hidden|clip)/;

/** Предки области, которые обрезают её содержимое: iframe над областью обрезается так же. */
const clippingAncestors = (slot: HTMLElement): HTMLElement[] => {
    const result: HTMLElement[] = [];
    for (let node = slot.parentElement; node && node !== document.body; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (CLIPPING_OVERFLOW.test(`${style.overflow} ${style.overflowX} ${style.overflowY}`)) result.push(node);
    }
    return result;
};

const px = (value: number) => `${Math.round(value * 100) / 100}px`;

/**
 * Держит слой с iframe над областью превью: каждый кадр сверяет её положение и размер (прокрутка, изменение окна,
 * сдвиг раскладки) и обновляет стиль слоя только при изменении.
 */
const followSlot = (layer: HTMLElement, slot: HTMLElement) => {
    const ancestors = clippingAncestors(slot);
    let last = '';
    let frame = 0;

    const update = () => {
        const rect = slot.getBoundingClientRect();
        let top = Math.max(rect.top, 0);
        let left = Math.max(rect.left, 0);
        let right = Math.min(rect.right, window.innerWidth);
        let bottom = Math.min(rect.bottom, window.innerHeight);
        for (const ancestor of ancestors) {
            const bounds = ancestor.getBoundingClientRect();
            top = Math.max(top, bounds.top);
            left = Math.max(left, bounds.left);
            right = Math.min(right, bounds.right);
            bottom = Math.min(bottom, bounds.bottom);
        }
        const key = [rect.top, rect.left, rect.width, rect.height, top, left, right, bottom].join(',');
        if (key === last) return;
        last = key;

        layer.style.top = px(rect.top);
        layer.style.left = px(rect.left);
        layer.style.width = px(rect.width);
        layer.style.height = px(rect.height);
        // `position: fixed` внутри предка с transform считается от предка: поправляем на фактическое смещение.
        const placed = layer.getBoundingClientRect();
        if (Math.abs(placed.top - rect.top) > 0.5) layer.style.top = px(2 * rect.top - placed.top);
        if (Math.abs(placed.left - rect.left) > 0.5) layer.style.left = px(2 * rect.left - placed.left);
        layer.style.clipPath = `inset(${[top - rect.top, rect.right - right, rect.bottom - bottom, left - rect.left]
            .map((value) => px(Math.max(0, value)))
            .join(' ')})`;
    };

    const loop = () => {
        update();
        frame = requestAnimationFrame(loop);
    };
    update();
    frame = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(frame);
};

let nextSlotId = 0;

interface ComposePreviewSlotProps {
    pluginUrl: string;
    /** Компонент редактора, чей кадр показывает область. */
    owner: string;
    /** Пока payload нет, область показывает состояние загрузки. */
    payload?: PreviewPayloadInput;
    onDescription?: (description: PreviewComponentDescription) => void;
    onDescriptionError?: (error: Error) => void;
}

/**
 * Область Compose-превью. В разделе компонентов показывает общий iframe хоста; вне хоста (нет провайдера) рисует
 * собственный ComposePreviewFrame, как раньше.
 */
export const ComposePreviewSlot = ({
    pluginUrl,
    owner,
    payload,
    onDescription,
    onDescriptionError,
}: ComposePreviewSlotProps) => {
    const host = useComposePreviewHost();
    const slotRef = useRef<HTMLDivElement>(null);
    // Каждая область — новый получатель, даже для того же компонента: её состояние описания пустое.
    const [slotId] = useState(() => ++nextSlotId);
    const subscriber = `${slotId}:${owner}`;

    useLayoutEffect(() => {
        const slot = slotRef.current;
        if (!host || !slot) return;
        host.render({ owner: subscriber, payload, onDescription, onDescriptionError }, slot);
    }, [host, subscriber, payload, onDescription, onDescriptionError]);

    useLayoutEffect(() => {
        if (!host) return;
        return () => host.hide(subscriber);
    }, [host, subscriber]);

    if (!host) {
        return (
            <ComposePreviewFrame
                pluginUrl={pluginUrl}
                payload={payload}
                subscriber={subscriber}
                onDescription={onDescription}
                onDescriptionError={onDescriptionError}
            />
        );
    }

    return <SlotRoot ref={slotRef} data-testid="compose-preview-slot" />;
};
