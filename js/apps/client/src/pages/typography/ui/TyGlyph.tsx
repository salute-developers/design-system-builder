// Глифы `uiIcon` прототипа (app.js, UI_GLYPHS), которые нужны экрану Typography.
const GLYPHS = {
    search: (
        <>
            <circle cx="11" cy="11" r="6" />
            <path d="m15.5 15.5 4 4" />
        </>
    ),
    close: (
        <g transform="scale(1.5)">
            <path
                fill="currentColor"
                stroke="none"
                fillRule="evenodd"
                clipRule="evenodd"
                d="M3.396 3.396a.5.5 0 0 1 .708 0L8 7.293l3.896-3.897a.5.5 0 1 1 .708.708L8.707 8l3.897 3.896a.5.5 0 0 1-.708.708L8 8.707l-3.896 3.897a.5.5 0 0 1-.708-.708L7.293 8 3.396 4.104a.5.5 0 0 1 0-.708Z"
            />
        </g>
    ),
    'chevron-down': <path d="m6 9.5 6 5.5 6-5.5" />,
    jump: (
        <>
            <path d="M5 5v6a4 4 0 0 0 4 4h9" />
            <path d="m14.5 11 4 4-4 4" />
        </>
    ),
} as const;

export type TyGlyphName = keyof typeof GLYPHS;

export const TyGlyph = ({ name }: { name: TyGlyphName }) => (
    <svg className="ui-glyph" viewBox="0 0 24 24" aria-hidden="true">
        {GLYPHS[name]}
    </svg>
);
