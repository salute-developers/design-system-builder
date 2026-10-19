import styled, { css } from 'styled-components';

const outline = 'var(--builder-outline-primary, #3d3f42)';
const subtleOutline = 'var(--p-line, #ffffff1a)';
const control = 'var(--builder-control, #ffffff08)';
const selected = 'var(--p-surface, #3d3f42)';
const text = 'var(--p-text, #f3f3f3)';
const secondaryText = 'var(--builder-text-secondary, #dbdbdc)';
const mutedText = 'var(--p-muted, #9e9fa2)';
const accent = 'var(--p-accent, #2b8ced)';

export const CountBadge = styled.span`
    display: inline-flex;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    flex: none;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    background: var(--builder-counter-background, #505155);
    color: #fff;
    font:
        600 10px/12px Inter,
        system-ui,
        sans-serif;
`;

export const Page = styled.section`
    display: grid;
    width: 100%;
    min-width: 0;
    min-height: 0;
    grid-template-columns: 280px minmax(0, 1fr) 320px;
    overflow: hidden;
    color: ${text};
    font:
        400 12px/14px Inter,
        system-ui,
        sans-serif;

    @media (max-width: 1100px) {
        grid-template-columns: 240px minmax(0, 1fr) 280px;
    }

    @media (max-width: 820px) {
        min-height: 100%;
        grid-template-columns: minmax(0, 1fr);
        grid-auto-rows: max-content;
        align-content: start;
        overflow: auto;
    }
`;

export const Sidebar = styled.aside`
    display: flex;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
    overflow: hidden;
    border-right: 1px solid ${outline};

    @media (max-width: 820px) {
        min-height: max-content;
        overflow: visible;
        border-right: 0;
        border-bottom: 1px solid ${outline};
    }
`;

export const SidebarHeader = styled.header`
    display: flex;
    height: 40px;
    min-height: 40px;
    padding: 0 12px;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid ${outline};

    strong {
        font-weight: 400;
    }
`;

export const SidebarBody = styled.div`
    min-height: 0;
    flex: 1;
    overflow-x: hidden;
    overflow-y: auto;

    @media (max-width: 820px) {
        flex: none;
        overflow: visible;
    }
`;

export const SidebarSection = styled.section`
    padding: 0 8px;

    &:first-child {
        padding-top: 8px;
    }

    > small {
        display: flex;
        height: 32px;
        padding: 0 8px;
        align-items: center;
        color: ${text};
        font-weight: 600;
        line-height: 16px;
    }
`;

export const List = styled.div`
    display: flex;
    min-width: 0;
    flex-direction: column;
`;

export const FilterButton = styled.button<{ $selected?: boolean }>`
    display: flex;
    width: 100%;
    height: 32px;
    padding: 4px 8px;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    border: 0;
    border-radius: 6px;
    background: ${({ $selected }) => ($selected ? selected : 'transparent')};
    color: ${({ $selected }) => ($selected ? text : secondaryText)};
    font: inherit;
    text-align: left;
    cursor: pointer;

    &:hover {
        background: ${control};
        color: ${text};
    }
    &:focus-visible {
        outline: 1px solid ${accent};
        outline-offset: 1px;
    }
    > span:first-child {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    ${CountBadge} {
        margin-left: auto;
        color: #fff;
    }
`;

export const Center = styled.main`
    display: flex;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
    overflow: hidden;

    @media (max-width: 820px) {
        min-height: 400px;
        overflow: visible;
    }
`;

export const CenterHeader = styled.header`
    display: flex;
    height: 40px;
    min-height: 40px;
    padding: 0 16px;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    border-bottom: 1px solid ${outline};

    strong {
        min-width: 0;
        overflow: hidden;
        font-weight: 400;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    span {
        color: ${mutedText};
        letter-spacing: -0.24px;
        white-space: nowrap;
    }
`;

export const CenterBody = styled.div`
    min-height: 0;
    flex: 1;
    overflow: auto;

    @media (max-width: 820px) {
        flex: none;
        overflow: visible;
    }
`;

export const ChangeGroup = styled.section`
    > h2 {
        display: flex;
        height: 32px;
        margin: 16px 0 0;
        padding: 0 12px;
        align-items: center;
        color: ${text};
        font:
            600 12px/16px Inter,
            system-ui,
            sans-serif;
    }
`;

export const ItemButton = styled.button<{ $selected?: boolean }>`
    position: relative;
    display: grid;
    width: 100%;
    min-height: 52px;
    padding: 8px 12px;
    grid-template-columns: minmax(0, 7fr) minmax(0, 3fr);
    align-items: center;
    gap: 16px;
    border: 0;
    border-bottom: 1px solid ${outline};
    background: ${({ $selected }) => ($selected ? control : 'transparent')};
    box-shadow: ${({ $selected }) => ($selected ? `inset 2px 0 0 ${accent}` : 'none')};
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;

    &:hover {
        background: ${control};
    }
    &:focus-visible {
        outline: 1px solid ${accent};
        outline-offset: -1px;
    }
    > span {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    strong {
        overflow: hidden;
        font-weight: 400;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    small {
        overflow: hidden;
        color: ${mutedText};
        letter-spacing: -0.24px;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    > small {
        text-align: right;
    }

    @media (max-width: 1100px) {
        grid-template-columns: minmax(0, 1fr);
    }

    @media (max-width: 480px) {
        grid-template-columns: minmax(0, 1fr);
        gap: 8px;
        > small {
            text-align: left;
        }
    }
`;

export const ChangeRow = styled.article<{ $selected?: boolean }>`
    display: grid;
    min-width: 0;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    padding-right: 12px;
    border-bottom: 1px solid ${outline};
    background: ${({ $selected }) => ($selected ? control : 'transparent')};
    box-shadow: ${({ $selected }) => ($selected ? `inset 2px 0 0 ${accent}` : 'none')};

    &:hover {
        background: ${control};
    }
    ${ItemButton} {
        border-bottom: 0;
        background: transparent;
        box-shadow: none;
        &:hover {
            background: transparent;
        }
    }
`;

export const UndoButton = styled.button`
    display: grid;
    width: 24px;
    height: 24px;
    padding: 4px;
    place-items: center;
    border: 0;
    border-radius: 5px;
    background: ${control};
    color: ${secondaryText};
    cursor: pointer;

    &:hover:not(:disabled) {
        background: ${selected};
        color: ${text};
    }
    &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
    &:focus-visible {
        outline: 1px solid ${accent};
        outline-offset: 1px;
    }
`;

export const Inspector = styled.aside`
    display: flex;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
    overflow: hidden;
    border-left: 1px solid ${outline};

    @media (max-width: 820px) {
        grid-column: 1;
        min-height: 360px;
        border-top: 1px solid ${outline};
        border-left: 0;
    }
`;

export const InspectorHeader = styled.header`
    display: flex;
    min-height: 72px;
    padding: 8px 12px 12px;
    flex-direction: column;
    gap: 4px;
    border-bottom: 1px solid ${outline};

    > div {
        display: flex;
        min-width: 0;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
    }
    strong {
        min-width: 0;
        overflow: hidden;
        font-weight: 600;
        line-height: 16px;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    span,
    small {
        overflow: hidden;
        color: ${mutedText};
        letter-spacing: -0.24px;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
`;

export const InspectorBody = styled.div`
    min-height: 0;
    flex: 1;
    overflow: auto;
    padding-bottom: 12px;
`;

export const InspectorSection = styled.section<{ $compactHeading?: boolean }>`
    padding: 8px 0;
    border-bottom: 1px solid ${outline};

    > h2 {
        display: flex;
        height: ${({ $compactHeading }) => ($compactHeading ? '16px' : '32px')};
        margin: 0;
        padding: 0 12px;
        align-items: center;
        font:
            600 12px/16px Inter,
            system-ui,
            sans-serif;
    }

    > p {
        margin: 0;
        padding: 0 12px 8px;
        color: ${mutedText};
        line-height: 16px;
    }
`;

export const InspectorRow = styled.div`
    display: flex;
    min-height: 32px;
    padding: 7px 12px;
    align-items: center;
    justify-content: space-between;
    gap: 12px;

    > span {
        min-width: 0;
        color: ${secondaryText};
    }
    > strong {
        min-width: 0;
        margin-left: auto;
        overflow: hidden;
        color: ${mutedText};
        font-weight: 400;
        text-align: right;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
`;

export const FieldList = styled.dl`
    margin: 0;

    > div {
        padding: 8px 12px;
        border-top: 1px solid ${subtleOutline};
    }
    > div:first-child {
        border-top: 0;
        padding-top: 4px;
    }
    dt {
        margin-bottom: 16px;
        overflow-wrap: anywhere;
        color: ${mutedText};
    }
    dd {
        margin: 0;
    }
`;

export const ValuePair = styled.div`
    display: grid;
    grid-template-columns: 1fr;
    gap: 4px;

    > div {
        display: grid;
        min-width: 0;
        grid-template-columns: 48px minmax(0, 1fr);
        align-items: center;
    }
    > div > span:first-child {
        color: ${mutedText};
    }
    b {
        overflow-wrap: anywhere;
        white-space: pre-wrap;
    }
`;

export const InspectorFooter = styled.footer`
    display: flex;
    padding: 12px;
    flex-direction: column;
    gap: 8px;
    border-top: 1px solid ${outline};
`;

export const Button = styled.button`
    display: inline-flex;
    min-height: 24px;
    padding: 4px 8px;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 6px;
    background: ${accent};
    color: #fff;
    font:
        400 12px/16px Inter,
        system-ui,
        sans-serif;
    cursor: pointer;

    &:hover:not(:disabled) {
        filter: brightness(0.95);
    }
    &:disabled {
        cursor: not-allowed;
        opacity: 0.4;
    }
    &:focus-visible {
        outline: 1px solid #fff;
        outline-offset: 1px;
    }
`;

export const SecondaryButton = styled(Button)`
    border: 1px solid ${outline};
    background: transparent;
    color: ${text};

    &:hover:not(:disabled) {
        background: ${control};
        filter: none;
    }
`;

export const ActionRow = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
`;

export const Status = styled.div`
    margin: 12px;
    padding: 10px 12px;
    border: 1px solid ${subtleOutline};
    border-radius: 6px;
    background: ${control};
    color: ${mutedText};
    line-height: 16px;

    ${ActionRow} {
        margin-top: 8px;
    }
`;

export const EmptyState = styled.div`
    display: flex;
    min-height: 280px;
    padding: 40px;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    text-align: center;

    h2 {
        margin: 0 0 6px;
        color: ${text};
        font:
            500 16px/22px Inter,
            system-ui,
            sans-serif;
    }
    p {
        max-width: 420px;
        margin: 0;
        color: ${mutedText};
        line-height: 18px;
    }
`;

export const Form = styled.form`
    display: flex;
    min-height: 100%;
    flex-direction: column;
`;

export const ReleaseSection = styled.section`
    border-bottom: 1px solid ${outline};

    > h2 {
        height: 28px;
        margin: 0;
        padding: 6px 12px;
        color: ${secondaryText};
        font:
            600 12px/16px Inter,
            system-ui,
            sans-serif;
        text-transform: uppercase;
    }
`;

export const VersionNumberRow = styled.label`
    display: grid;
    min-height: 52px;
    padding: 8px 12px;
    grid-template-columns: minmax(150px, 1fr) 196px;
    align-items: center;
    gap: 16px;

    > span {
        display: flex;
        min-width: 0;
        flex-direction: column;
        gap: 4px;
    }
    strong {
        font-weight: 400;
    }
    small {
        color: ${mutedText};
    }
    input {
        width: 196px;
        height: 24px;
        padding: 4px 8px;
        border: 1px solid ${subtleOutline};
        border-radius: 6px;
        background: ${control};
        color: ${text};
        font: inherit;
    }
    input:focus-visible {
        border-color: ${accent};
        outline: 0;
    }

    @media (max-width: 1100px) {
        grid-template-columns: minmax(130px, 1fr) 160px;
        input {
            width: 160px;
        }
    }

    @media (max-width: 480px) {
        grid-template-columns: minmax(0, 1fr);
        gap: 8px;
        input {
            width: 100%;
        }
    }
`;

export const NotesLabel = styled.label`
    display: block;

    > span {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
    }
    textarea {
        width: calc(100% - 24px);
        height: 84px;
        margin: 0 12px 8px;
        padding: 6px;
        border: 1px solid transparent;
        border-radius: 6px;
        background: var(--builder-surface-transparent-secondary, #ffffff1a);
        color: ${secondaryText};
        font:
            400 12px/14px Inter,
            system-ui,
            sans-serif;
        resize: none;
    }
    textarea:focus-visible {
        border-color: ${accent};
        outline: 0;
    }
`;

export const ReleaseNotes = styled.p`
    min-height: 52px;
    margin: 0;
    padding: 8px 12px 12px;
    color: ${secondaryText};
    line-height: 18px;
    white-space: pre-wrap;
`;

export const DiffPreview = styled.span`
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) 12px minmax(0, 1fr);
    min-height: 24px;
    align-items: center;
    gap: 8px !important;

    > i {
        color: ${mutedText};
        font-style: normal;
        text-align: center;
    }
    b {
        overflow-wrap: anywhere;
        white-space: normal;
    }
`;

export const ValueChip = styled.span<{ $truncate?: boolean }>`
    display: flex;
    min-width: 0;
    min-height: 24px;
    padding: 4px 6px;
    align-items: center;
    gap: 4px;
    overflow: hidden;
    border: 1px solid ${subtleOutline};
    border-radius: 6px;
    background: ${control};
    color: ${text};
    line-height: 14px;

    > b {
        min-width: 0;
        font-weight: 400;
        overflow-wrap: anywhere;
    }
    ${({ $truncate }) =>
        $truncate &&
        css`
            && > b {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                overflow-wrap: normal;
            }
        `}
    > i {
        width: 14px;
        height: 14px;
        flex: none;
        border: 1px solid ${subtleOutline};
        border-radius: 3px;
    }
`;
