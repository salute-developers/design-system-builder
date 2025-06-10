import styled from 'styled-components';
import { Select, Switch, TextField, TextS } from '@salutejs/plasma-b2c';

const StyledRoot = styled.div`
    margin-top: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;

    gap: 1rem;
`;

const StyledSelect = styled(Select)`
    width: 25rem;
`;

const StyledTextField = styled(TextField)`
    width: 25rem;
`;

interface ComponentControlProps {
    name: string;
    value: string | boolean;
    items?: {
        value: string;
        label: string;
    }[];
    onChangeValue: (name: string, value: string | unknown) => void;
}

export const ComponentControl = (props: ComponentControlProps) => {
    const { name, items, value, onChangeValue } = props;

    const isBooleanProp = typeof value === 'boolean';
    const isStringProp = !Array.isArray(items) && typeof value === 'string';
    const isListProp = Array.isArray(items) && typeof value === 'string';

    const handleOnChange = (param: React.ChangeEvent<HTMLInputElement> | unknown) => {
        if (isListProp) {
            onChangeValue(name, param);
            return;
        }

        const event = param as React.ChangeEvent<HTMLInputElement>;

        if (isStringProp) {
            const value = event.target.value;
            onChangeValue(name, value);
            return;
        }

        if (isBooleanProp) {
            const value = event.target.checked;
            onChangeValue(name, value);
        }
    };

    return (
        <StyledRoot>
            <TextS>{name}</TextS>
            {isBooleanProp && <Switch size="s" checked={value} onChange={handleOnChange} />}
            {isStringProp && <StyledTextField size="s" value={value} onChange={handleOnChange} />}
            {isListProp && (
                <StyledSelect
                    listOverflow="scroll"
                    listMaxHeight="25"
                    size="s"
                    items={items}
                    value={value}
                    onChange={handleOnChange}
                />
            )}
        </StyledRoot>
    );
};
