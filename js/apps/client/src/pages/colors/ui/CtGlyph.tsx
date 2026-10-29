// Глифы `uiIcon` прототипа (app.js, UI_GLYPHS), которые нужны экрану Color Tokens.
const GLYPHS = {
    add: <path d="M12 5v14M5 12h14" />,
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
    sliders: (
        <g transform="scale(1.5)">
            <path
                fill="currentColor"
                stroke="none"
                fillRule="evenodd"
                clipRule="evenodd"
                d="M10.771 6.3a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2Zm0 1a2.1 2.1 0 0 0 2.04-1.6h1.459a.5.5 0 0 0 0-1h-1.459a2.1 2.1 0 0 0-4.081 0H1.67a.5.5 0 0 0 0 1h7.06a2.1 2.1 0 0 0 2.041 1.6ZM5.218 11.9a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2Zm0 1a2.1 2.1 0 0 1-2.041-1.6H1.718a.5.5 0 0 1 0-1h1.459a2.1 2.1 0 0 1 4.081 0h7.06a.5.5 0 0 1 0 1h-7.06a2.1 2.1 0 0 1-2.04 1.6Z"
            />
        </g>
    ),
    'chevron-down': <path d="m6 9.5 6 5.5 6-5.5" />,
    delete: <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />,
    reset: (
        <>
            <path d="M4.5 8.5A8 8 0 1 1 4 14" />
            <path d="M4.5 4v4.5H9" />
        </>
    ),
} as const;

export type GlyphName = keyof typeof GLYPHS;

export const CtGlyph = ({ name }: { name: GlyphName }) => (
    <svg className="ui-glyph" viewBox="0 0 24 24" aria-hidden="true">
        {GLYPHS[name]}
    </svg>
);
