import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { IconArrowBack } from '@salutejs/plasma-icons';

import { HeroTextField } from '../components/HeroTextField';
import { IconButton } from '../components/IconButton';

const Root = styled.div``;

const StyledIconButton = styled(IconArrowBack)`
    --icon-size: 3.25rem !important;
`;

interface CreateFirstNameProps {
    onPrevPage: () => void;
    onNextPage: (data: string) => void;
}

export const CreateFirstName = (props: CreateFirstNameProps) => {
    const { onPrevPage, onNextPage } = props;

    const [value, setValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setValue(event.target.value);
    };

    const onBlur = () => {
        if (!value) {
            onPrevPage();
        }
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            onNextPage(value);
        }

        if (event.key === 'Escape') {
            onPrevPage();
        }
    };

    const onClick = () => {
        onNextPage(value);
    };

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    return (
        <Root>
            <HeroTextField
                value={value}
                ref={inputRef}
                placeholder="Начните с имени проекта"
                dynamicContentRight={
                    <IconButton onClick={onClick}>
                        <StyledIconButton size="s" color="inherit" />
                    </IconButton>
                }
                dynamicHelper="без спецсимволов, можно по-русски — название пакетов транслитерируем по правилам"
                onBlur={onBlur}
                onChange={onChange}
                onKeyDown={onKeyDown}
            />
        </Root>
    );
};
