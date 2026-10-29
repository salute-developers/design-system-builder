import { Root, StyledIndicator, StyledSpinner } from './EditorLoading.styles';

interface EditorLoadingProps {
    text: string;
}

/** Единый индикатор загрузки редактора темы: тема, затем данные раздела показываются на одном месте. */
export const EditorLoading = ({ text }: EditorLoadingProps) => (
    <Root>
        <StyledIndicator role="status" aria-live="polite">
            <StyledSpinner aria-hidden="true" />
            <span>{text}</span>
        </StyledIndicator>
    </Root>
);
