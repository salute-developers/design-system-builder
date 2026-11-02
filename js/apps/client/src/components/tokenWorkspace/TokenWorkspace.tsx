import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CloseOutline, RotateCcwOutline, SearchOutline } from '@salutejs/sdds-icons/16';

interface TreeHeaderProps {
    /** Заголовок панели; вместо него можно показать `leading`, например сортировку. */
    title?: ReactNode;
    leading?: ReactNode;
    /** Действия справа: фильтр, «+». Показываются и при открытом поиске. */
    actions?: ReactNode;
    searching: boolean;
    query: string;
    /** Подсказка поля поиска; по умолчанию «Найти». */
    placeholder?: string;
    /** Подпись поля поиска для чтения с экрана; по умолчанию «Найти токен». */
    searchLabel?: string;
    onQuery: (query: string) => void;
    onSearchOpen: (open: boolean) => void;
}

/** Шапка дерева `Sidebar/CatalogHeader`: поле поиска встаёт на место заголовка и закрывается «Закрыть поиск». */
export const TreeHeader = ({
    title,
    leading,
    actions,
    searching,
    query,
    placeholder = 'Найти',
    searchLabel = 'Найти токен',
    onQuery,
    onSearchOpen,
}: TreeHeaderProps) => (
    <div className={`tw-tree-header ${searching ? 'is-searching' : ''}`}>
        {searching ? (
            <label className="tw-search-field">
                <SearchOutline />
                <input
                    autoFocus
                    value={query}
                    placeholder={placeholder}
                    aria-label={searchLabel}
                    onChange={(event) => onQuery(event.target.value)}
                />
            </label>
        ) : (
            (leading ?? <strong className="tw-tree-header-title">{title}</strong>)
        )}
        <div className="tw-tree-header-actions">
            {actions}
            {searching ? (
                <button
                    type="button"
                    className="tw-icon-button"
                    aria-label="Закрыть поиск"
                    title="Закрыть поиск"
                    onClick={() => {
                        onQuery('');
                        onSearchOpen(false);
                    }}
                >
                    <CloseOutline />
                </button>
            ) : (
                <button
                    type="button"
                    className="tw-icon-button"
                    aria-label="Поиск"
                    title="Поиск"
                    onClick={() => onSearchOpen(true)}
                >
                    <SearchOutline />
                </button>
            )}
        </div>
    </div>
);

const INSTANCE_FORMS: Partial<Record<Intl.LDMLPluralRule, string>> = { one: 'экземпляр', few: 'экземпляра' };
const pluralRu = new Intl.PluralRules('ru');

/** «1 экземпляр», «3 экземпляра», «5 экземпляров» — счётчик в заголовке списка компонентов инспектора. */
export const instancesLabel = (count: number) => `${count} ${INSTANCE_FORMS[pluralRu.select(count)] ?? 'экземпляров'}`;

/** Текст пустого результата поиска по Figma. */
export const SEARCH_EMPTY_TEXT = 'По вашему запросу ничего не найдено';

/** Пустой результат поиска или пустой раздел — `Search/EmptyState`. */
export const TreeEmpty = ({ children = SEARCH_EMPTY_TEXT }: { children?: ReactNode }) => (
    <p className="tw-tree-empty" role="status">
        {children}
    </p>
);

interface EditableTextProps {
    value: string;
    label: string;
    className: string;
    /** Пустое значение разрешено только описанию. */
    allowEmpty?: boolean;
    placeholder?: string;
    onSave?: (value: string) => Promise<void>;
    /** Текст поля правки, если правится не всё показанное значение: у стиля типографики — размер. */
    editValue?: string;
}

/**
 * Текст шапки инспектора, редактируемый на месте: двойной щелчок или Enter открывают поле, Enter и уход фокуса
 * сохраняют, Escape отменяет. Ошибка сохранения остаётся у поля.
 */
export const EditableText = ({
    value,
    label,
    className,
    allowEmpty = false,
    placeholder,
    onSave,
    editValue,
}: EditableTextProps) => {
    const [draft, setDraft] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    // Escape убирает поле, а браузер при этом шлёт blur: отменённая правка не должна сохраниться.
    const cancelled = useRef(false);
    if (!onSave) return <span className={className}>{value || placeholder}</span>;
    const save = async () => {
        if (cancelled.current) return;
        const next = (draft ?? '').trim();
        if (next === (editValue ?? value).trim() || (!next && !allowEmpty)) return setDraft(null);
        setBusy(true);
        try {
            await onSave(next);
            setDraft(null);
            setError(null);
        } catch (cause) {
            setError(String((cause as Error)?.message ?? cause));
        } finally {
            setBusy(false);
        }
    };
    const edit = (initial: string) => {
        cancelled.current = false;
        setDraft(initial);
    };
    if (draft === null)
        return (
            <span
                className={`${className} tw-editable ${value ? '' : 'is-empty'}`}
                role="button"
                tabIndex={0}
                aria-label={label}
                title="Дважды щёлкните, чтобы изменить"
                onDoubleClick={() => edit(editValue ?? value)}
                onKeyDown={(event) => event.key === 'Enter' && edit(editValue ?? value)}
            >
                {value || placeholder}
            </span>
        );
    return (
        <span className="tw-editable-field">
            <input
                autoFocus
                className={`${className} ${fieldClass(error ? 'error' : null)}`}
                aria-label={label}
                aria-invalid={Boolean(error)}
                value={draft}
                disabled={busy}
                placeholder={placeholder}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => void save()}
                onKeyDown={(event) => {
                    // Сохраняет только уход фокуса: иначе Enter и следующий за ним blur отправят правку дважды.
                    if (event.key === 'Enter') event.currentTarget.blur();
                    if (event.key === 'Escape') {
                        cancelled.current = true;
                        setDraft(null);
                        setError(null);
                    }
                }}
            />
            {error && <FieldMessage>{error}</FieldMessage>}
        </span>
    );
};

interface InspectorHeaderProps {
    title: string;
    description?: string;
    /** Подсказка пустого описания; без неё у редактируемого описания — «Добавить описание». */
    descriptionPlaceholder?: string;
    /** Действия справа от заголовка, например удаление. */
    actions?: ReactNode;
    onRename?: (value: string) => Promise<void>;
    /** Текст поля переименования, если правится часть имени; по умолчанию — `title`. */
    renameValue?: string;
    onDescribe?: (value: string) => Promise<void>;
    /** Сброс изменений токена в черновике; кнопка показывается, если действие задано. */
    onReset?: () => void;
    resetDisabled?: boolean;
}

/** Шапка инспектора `Inspector/Header`: имя и описание на месте, «Сбросить изменения токена» и другие действия. */
export const InspectorHeader = ({
    title,
    description = '',
    descriptionPlaceholder,
    actions,
    onRename,
    renameValue,
    onDescribe,
    onReset,
    resetDisabled = false,
}: InspectorHeaderProps) => (
    <header className="tw-inspector-header">
        <div className="tw-inspector-header-row">
            <EditableText
                value={title}
                editValue={renameValue}
                label="Имя токена"
                className="tw-inspector-title"
                onSave={onRename}
            />
            {onReset && (
                <button
                    type="button"
                    className="tw-icon-button"
                    aria-label="Сбросить изменения токена"
                    title="Сбросить изменения токена"
                    disabled={resetDisabled}
                    onClick={onReset}
                >
                    <RotateCcwOutline />
                </button>
            )}
            {actions}
        </div>
        <EditableText
            value={description}
            label="Описание токена"
            className="tw-inspector-description"
            allowEmpty
            placeholder={descriptionPlaceholder ?? (onDescribe ? 'Добавить описание' : undefined)}
            onSave={onDescribe}
        />
    </header>
);

/** Заголовок секции `Panel/SectionHeader`: 12/16 600 в исходном регистре. */
export const SectionHeader = ({ title, actions }: { title: ReactNode; actions?: ReactNode }) => (
    <div className="tw-section-header" role="heading" aria-level={3}>
        <span>{title}</span>
        {actions}
    </div>
);

/** Сообщение под полем: ошибка или предупреждение значения. */
export const FieldMessage = ({ tone = 'error', children }: { tone?: 'error' | 'warning'; children: ReactNode }) => (
    <p
        className={`tw-field-message ${tone === 'warning' ? 'is-warning' : ''}`}
        role={tone === 'error' ? 'alert' : 'status'}
    >
        {children}
    </p>
);

/** Класс поля значения с состоянием: `tw-field`, `is-error` или `is-warning`. */
export const fieldClass = (tone?: 'error' | 'warning' | null) => `tw-field ${tone ? `is-${tone}` : ''}`;

/* Строк и плиток с запасом на окно 2048×1200: скелетон заполняет панель целиком, лишнее обрезает панель. */
const SKELETON_ROWS: Record<'tree' | 'inspector', number> = { tree: 36, inspector: 36 };
const SKELETON_TILE_ROWS = 10;
const SKELETON_TILES = 14;

const range = (length: number) => Array.from({ length }, (_, index) => index);

/** Скелетон панели при загрузке: строки дерева или инспектора, ряды плиток рабочей области — на всю панель. */
export const PanelSkeleton = ({ part }: { part: 'tree' | 'workspace' | 'inspector' }) => (
    <div className="tw-skeleton" aria-hidden="true" data-skeleton={part}>
        {part === 'workspace'
            ? range(SKELETON_TILE_ROWS).map((row) => (
                  <div className="tw-skeleton-tiles" key={row}>
                      {range(SKELETON_TILES).map((tile) => (
                          <span className="tw-skeleton-tile" key={tile} />
                      ))}
                  </div>
              ))
            : range(SKELETON_ROWS[part]).map((index) => <span className="tw-skeleton-bar" key={index} />)}
    </div>
);

/** Ошибка загрузки раздела `Foundation/WorkspaceState · Error`: без текста исключения, с «Повторить». */
export const WorkspaceLoadError = ({ title, onRetry }: { title: string; onRetry?: () => void }) => (
    <div className="tw-load-error" role="alert">
        <p className="tw-load-error-title">{title}</p>
        <p className="tw-load-error-text">Проверьте подключение и попробуйте ещё раз.</p>
        {onRetry && (
            <button type="button" className="tw-action-button" onClick={onRetry}>
                Повторить
            </button>
        )}
    </div>
);

/**
 * Escape закрывает окно, где бы ни был фокус: щелчок по тексту окна или недоступная кнопка уводят фокус на `body`, и
 * обработчик на самом окне его бы не получил.
 */
export const useEscapeKey = (onEscape: () => void) => {
    const latest = useRef(onEscape);
    latest.current = onEscape;
    useEffect(() => {
        const keyDown = (event: KeyboardEvent) => event.key === 'Escape' && latest.current();
        document.addEventListener('keydown', keyDown);
        return () => document.removeEventListener('keydown', keyDown);
    }, []);
};

interface ConfirmDeleteDialogProps {
    titleId: string;
    title: string;
    /** Имя удаляемого токена или группы под заголовком. */
    meta: ReactNode;
    children: ReactNode;
    confirmLabel: string;
    busy: boolean;
    /** Удаление ещё нельзя подтвердить, например не выбрана замена. */
    confirmDisabled?: boolean;
    error: string | null;
    onCancel: () => void;
    onConfirm: () => void;
}

/** Подтверждение удаления `Dialog/Confirmation` Tone=Danger: «Не удалять» и красная кнопка удаления. */
export const ConfirmDeleteDialog = ({
    titleId,
    title,
    meta,
    children,
    confirmLabel,
    busy,
    confirmDisabled = false,
    error,
    onCancel,
    onConfirm,
}: ConfirmDeleteDialogProps) => {
    useEscapeKey(onCancel);
    return (
        <div className="tw-dialog-backdrop">
            <section className="tw-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
                <div className="tw-dialog-head">
                    <h2 className="tw-dialog-title" id={titleId}>
                        {title}
                    </h2>
                    <span className="tw-dialog-meta">{meta}</span>
                </div>
                <div className="tw-dialog-body">
                    {children}
                    {error && (
                        <p className="tw-dialog-error" role="alert">
                            {error}
                        </p>
                    )}
                </div>
                <footer className="tw-dialog-actions">
                    <button type="button" className="tw-action-button is-secondary" autoFocus onClick={onCancel}>
                        Не удалять
                    </button>
                    <button
                        type="button"
                        className="tw-action-button is-danger"
                        disabled={busy || confirmDisabled}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                </footer>
            </section>
        </div>
    );
};
