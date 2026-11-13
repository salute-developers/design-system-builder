import { ICON_SIZES, type IconSize, type IconStyle } from '../domain/iconCatalog';

const STYLES: Array<{ value: IconStyle | 'all'; label: string }> = [
    { value: 'all', label: 'Все' },
    { value: 'outline', label: 'Outline' },
    { value: 'outline-bold', label: 'Bold' },
    { value: 'fill', label: 'Fill' },
];

interface SegmentProps<T extends string | number> {
    label: string;
    items: Array<{ value: T; label: string }>;
    value: T;
    onChange: (value: T) => void;
}

/** Переключатель из нескольких вариантов (`icon-segment`): та же сетка высот, что у полей инспектора. */
const Segment = <T extends string | number>({ label, items, value, onChange }: SegmentProps<T>) => (
    <div className="icon-segment" role="group" aria-label={label}>
        {items.map((item) => (
            <button
                key={item.value}
                type="button"
                className={item.value === value ? 'is-selected' : ''}
                aria-pressed={item.value === value}
                onClick={() => onChange(item.value)}
            >
                {item.label}
            </button>
        ))}
    </div>
);

interface IconFiltersProps {
    style: IconStyle | 'all';
    size: IconSize;
    onStyle: (style: IconStyle | 'all') => void;
    onSize: (size: IconSize) => void;
}

/** Начертание и размер иконок: две группы переключателей в одну строку. */
export const IconFilters = ({ style, size, onStyle, onSize }: IconFiltersProps) => (
    <div className="icon-filters">
        <Segment label="Начертание" items={STYLES} value={style} onChange={onStyle} />
        <Segment
            label="Размер"
            items={ICON_SIZES.map((item) => ({ value: item, label: String(item) }))}
            value={size}
            onChange={onSize}
        />
    </div>
);
