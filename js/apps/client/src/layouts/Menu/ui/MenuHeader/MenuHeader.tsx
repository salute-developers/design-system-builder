import { MouseEvent, RefObject } from 'react';
import { IconClose, IconSearch } from '@salutejs/plasma-icons';

import { IconButton, TextField } from '../../../../components';

import {
    Header,
    HeaderButtons,
    HeaderContent,
    HeaderTitle,
    StyledIconSearch,
    StyledIconSettingsFilter,
} from './MenuHeader.styles';

interface MenuHeaderProps {
    header?: string;
    isSearchOpen: boolean;
    searchQuery: string;
    filterButtonRef: RefObject<HTMLDivElement>;
    onSearchOpen: () => void;
    onSearchReset: () => void;
    onSearchChange: (value: string) => void;
    onFilterToggle: (event: MouseEvent<HTMLDivElement>) => void;
}

export const MenuHeader = (props: MenuHeaderProps) => {
    const {
        header,
        isSearchOpen,
        searchQuery,
        filterButtonRef,
        onSearchOpen,
        onSearchReset,
        onSearchChange,
        onFilterToggle,
    } = props;

    return (
        <Header>
            <HeaderContent>
                {isSearchOpen ? (
                    <TextField
                        stretched
                        autoFocus
                        compact
                        placeholder="Поиск токена"
                        value={searchQuery}
                        contentLeft={<IconSearch size="xs" color="inherit" />}
                        onChange={onSearchChange}
                    />
                ) : (
                    <HeaderTitle>{header}</HeaderTitle>
                )}
            </HeaderContent>
            <HeaderButtons>
                <IconButton onClick={isSearchOpen ? onSearchReset : onSearchOpen}>
                    {isSearchOpen ? (
                        <IconClose size="xs" color="inherit" />
                    ) : (
                        <StyledIconSearch size="xs" color="inherit" />
                    )}
                </IconButton>
                <div ref={filterButtonRef}>
                    <IconButton onClick={onFilterToggle}>
                        <StyledIconSettingsFilter size="xs" color="inherit" />
                    </IconButton>
                </div>
            </HeaderButtons>
        </Header>
    );
};
