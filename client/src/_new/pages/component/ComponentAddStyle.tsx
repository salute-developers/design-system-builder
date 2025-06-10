import { useState } from 'react';
import styled from 'styled-components';
import { Button, ModalBase, PopupBaseProvider, TextField, TextS } from '@salutejs/plasma-b2c';

import type { Config } from '../../../componentBuilder';

const StyledModal = styled.div`
    background: black;
    border-radius: 1rem;
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 1rem;
`;

interface ComponentAddStyleProps {
    config: Config;
    addStyleModal: { open: boolean; variationID?: string };
    setAddStyleModal: (value: { open: boolean; variationID?: string }) => void;
}

export const ComponentAddStyle = (props: ComponentAddStyleProps) => {
    const { config, addStyleModal, setAddStyleModal } = props;

    const [newStyleName, setNewStyleName] = useState('');

    const onCloseModal = () => {
        setNewStyleName('');
        setAddStyleModal({
            open: false,
            variationID: undefined,
        });
    };

    const onChangeStyleValue = (event: React.ChangeEvent<HTMLInputElement>) => {
        setNewStyleName(event.target.value);
    };

    const onAddStyle = () => {
        if (!addStyleModal.variationID || !newStyleName) {
            return;
        }

        config.addVariationStyle(addStyleModal.variationID, newStyleName);
        onCloseModal();
    };

    return (
        <PopupBaseProvider>
            <ModalBase onClose={onCloseModal} opened={addStyleModal.open} placement="center">
                <StyledModal>
                    <TextS>Имя стиля</TextS>
                    <TextField size="s" value={newStyleName} onChange={onChangeStyleValue} />
                    <Button size="s" text="Добавить" onClick={onAddStyle} />
                </StyledModal>
            </ModalBase>
        </PopupBaseProvider>
    );
};
