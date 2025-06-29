import { SegmentGroup, SegmentItem } from '@salutejs/plasma-b2c';

interface SegmentProps {
    items: { value: string; label: string }[];
    pilled?: boolean;
    hasBackground?: boolean;
    view?: 'accent' | 'clear' | 'default' | 'secondary';
    setActiveItem?: (value: { value: string; label: string }) => void;
}

export const Segment = (props: SegmentProps) => {
    const { items, hasBackground = false, pilled = true, view = 'accent', setActiveItem } = props;

    const onItemClick = (value: string, label: string) => {
        setActiveItem?.({ value, label });
    };

    return (
        <SegmentGroup size="xs" pilled={pilled} view="filled" hasBackground={hasBackground}>
            {items.map(({ label, value }, i) => (
                <SegmentItem
                    label={label}
                    value={value}
                    onMouseDown={() => onItemClick(value, label)}
                    key={`label_${i}`}
                    view={view}
                    size="xs"
                    pilled={pilled}
                />
            ))}
        </SegmentGroup>
    );
};
