import { MouseEvent } from 'react';

import { IconButton, TextField, Tooltip } from '../../../../../../components';

import {
    StyledDeleteTooltipAnchor,
    StyledDisplayNamePrefix,
    StyledHeader,
    StyledHeaderToken,
    StyledHeaderTokenButtons,
    StyledIconRotateCcw,
    StyledIconTrashOutline,
} from './TokenHeader.styles';

const deleteDisabledTooltipText = 'Невозможно удалить токен, который уже опубликован';

interface TokenHeaderProps {
    groupCamel: string;
    defaultTokenSuffix: string;
    description: string | undefined;
    canEditName: boolean;
    canDelete: boolean;
    onDisplayNameSuffixCommit: (value: string) => void;
    onDescriptionChange: (value: string) => void;
    onReset: () => void;
    onDeleteClick: (event: MouseEvent<HTMLDivElement>) => void;
}

export const TokenHeader = (props: TokenHeaderProps) => {
    const {
        groupCamel,
        defaultTokenSuffix,
        description,
        canEditName,
        canDelete,
        onDisplayNameSuffixCommit,
        onDescriptionChange,
        onReset,
        onDeleteClick,
    } = props;

    return (
        <StyledHeader>
            <StyledHeaderToken>
                <TextField
                    value={defaultTokenSuffix}
                    contentLeft={<StyledDisplayNamePrefix>{groupCamel}</StyledDisplayNamePrefix>}
                    readOnly={!canEditName}
                    onCommit={onDisplayNameSuffixCommit}
                />
                <StyledHeaderTokenButtons>
                    <IconButton onClick={onReset}>
                        <StyledIconRotateCcw size="xs" color="inherit" />
                    </IconButton>
                    <StyledDeleteTooltipAnchor>
                        <IconButton disabled={!canDelete} onClick={onDeleteClick}>
                            <StyledIconTrashOutline size="xs" color="inherit" />
                        </IconButton>
                        {!canDelete && (
                            <Tooltip
                                multiline
                                maxWidth={16}
                                placement="bottom"
                                offset={[0.5, 0]}
                                text={deleteDisabledTooltipText}
                            />
                        )}
                    </StyledDeleteTooltipAnchor>
                </StyledHeaderTokenButtons>
            </StyledHeaderToken>
            <TextField
                value={description}
                maxWidth={286}
                placeholder="Добавить описание"
                onCommit={onDescriptionChange}
            />
        </StyledHeader>
    );
};
