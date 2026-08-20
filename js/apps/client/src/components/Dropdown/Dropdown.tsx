import { ReactNode, useEffect, useRef } from 'react';

import { Root, StyledBeforeList, StyledItem, StyledItemText, StyledContentRight } from './Dropdown.styles';

export interface DropdownItem<T extends string = string, U extends ReactNode = ReactNode> {
    value: T;
    label?: U;
    disabled?: boolean;
    contentRight?: ReactNode;
}

interface DropdownProps<T extends DropdownItem> {
    selected?: T;
    items: ReadonlyArray<T> | T[];
    autoAlign?: boolean;
    beforeList?: ReactNode;
    onItemSelect?: (value: T) => void;
    onItemHover?: (value: T) => void;
    onClose?: (value: boolean) => void;
    onOutsideClick?: () => void;
}

export const Dropdown = <T extends DropdownItem>(props: DropdownProps<T>) => {
    const {
        items,
        selected,
        autoAlign = true,
        beforeList,
        onItemSelect,
        onClose,
        onItemHover,
        onOutsideClick,
        ...rest
    } = props;

    const itemsRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const onClick = (value: T) => {
        if (value.disabled) {
            return;
        }

        if (onItemSelect) {
            onItemSelect(value);
        }

        if (onClose) {
            onClose(false);
        }
    };

    const onMouseEnter = (value: T) => {
        if (value.disabled) {
            return;
        }

        if (onItemHover) {
            onItemHover(value);
        }
    };

    useEffect(() => {
        if (!selected) {
            return;
        }

        const container = itemsRef.current;
        const target = itemRefs.current[`${selected.label}_${selected.value}`];

        if (!container) {
            return;
        }

        if (!autoAlign) {
            container.style.top = '100%';

            return;
        }

        if (!target) {
            container.style.top = '0px';

            return;
        }

        const itemTop = target.offsetTop;

        // Накладываем дропдаун на триггер так, чтобы выбранный элемент оказался напротив него.
        // Если контент длиннее видимой области — скроллим к выбранному и не уводим контейнер
        // выше его начала (иначе сверху появится пустота).
        const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
        const scrollTop = Math.min(itemTop, maxScrollTop);

        container.style.top = `-${itemTop - scrollTop}px`;
        container.scrollTop = scrollTop;
    }, [autoAlign, selected]);

    useEffect(() => {
        const onDocumentClick = (event: MouseEvent) => {
            event.stopPropagation();

            if (!itemsRef.current || itemsRef.current.contains(event.target as Node)) {
                return;
            }

            if (onClose) {
                onClose(false);
            }

            if (onOutsideClick) {
                onOutsideClick();
            }
        };

        document.addEventListener('mousedown', onDocumentClick);

        return () => {
            document.removeEventListener('mousedown', onDocumentClick);
        };
    }, [onOutsideClick, onClose]);

    return (
        <Root ref={itemsRef} {...rest}>
            {beforeList && <StyledBeforeList>{beforeList}</StyledBeforeList>}
            {items.length > 0 ? (
                items.map((item, index) => (
                    <StyledItem
                        key={`${item.value}_${index}`}
                        ref={(el) => {
                            itemRefs.current[`${item.label}_${item.value}`] = el;
                        }}
                        selected={
                            selected?.value === item.value &&
                            (selected.label !== undefined ? selected.label === item.label : true)
                        }
                        disabled={item.disabled}
                        onClick={() => onClick(item)}
                        onMouseEnter={() => onMouseEnter(item)}
                    >
                        <StyledItemText>{item.label}</StyledItemText>
                        <StyledContentRight>{item.contentRight}</StyledContentRight>
                    </StyledItem>
                ))
            ) : (
                <StyledItem>
                    <StyledItemText>Ничего нет</StyledItemText>
                </StyledItem>
            )}
        </Root>
    );
};

