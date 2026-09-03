import { Modal } from '../../../../components';
import { tokenFilterList, TokenFilterValue, validateFilterList } from '../../Menu.utils';

import {
    FilterPopupItem,
    FilterPopupItemCheck,
    FilterPopupItemText,
    FilterPopupRoot,
    FilterPopupSeparator,
    StyledIconDone,
} from './MenuFilterPopup.styles';

interface MenuFilterPopupProps {
    opened: boolean;
    anchor?: HTMLElement;
    tokenFilter: TokenFilterValue;
    onClose: () => void;
    onTokenFilterSelect: (value: TokenFilterValue) => void;
}

export const MenuFilterPopup = (props: MenuFilterPopupProps) => {
    const { opened, anchor, tokenFilter, onClose, onTokenFilterSelect } = props;

    return (
        <Modal opened={opened} anchor={anchor} anchorOffsetX={4} anchorOffsetY={0} onClose={onClose}>
            <FilterPopupRoot>
                {tokenFilterList.map(({ disabled, label, value }) => (
                    <FilterPopupItem
                        key={value}
                        selected={tokenFilter === value}
                        onClick={() => onTokenFilterSelect(value)}
                        disabled={disabled}
                    >
                        <FilterPopupItemCheck>
                            {tokenFilter === value && <StyledIconDone color="inherit" />}
                        </FilterPopupItemCheck>
                        <FilterPopupItemText>{label}</FilterPopupItemText>
                    </FilterPopupItem>
                ))}
                <FilterPopupSeparator />
                {validateFilterList.map(({ disabled, label, value }) => (
                    <FilterPopupItem key={value} selected={value === 'all'} disabled={disabled}>
                        <FilterPopupItemCheck>
                            {value === 'all' && <StyledIconDone color="inherit" />}
                        </FilterPopupItemCheck>
                        <FilterPopupItemText>{label}</FilterPopupItemText>
                    </FilterPopupItem>
                ))}
            </FilterPopupRoot>
        </Modal>
    );
};
