// Глифы `uiIcon` прототипа (app.js, UI_GLYPHS), которые нужны экрану Typography.
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
    'chevron-down': <path d="m6 9.5 6 5.5 6-5.5" />,
    'chevron-right': <path d="m9.5 5 6 7-6 7" />,
    layers: (
        <>
            <path d="m12 3 8.5 4.5L12 12 3.5 7.5Z" />
            <path d="m4 12 8 4.2 8-4.2M4 16.5l8 4.2 8-4.2" />
        </>
    ),
    web: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
        </>
    ),
    compose: (
        <>
            <path d="M12 1.5 22.2 7.4v8.1c0 .8-.4 1.4-1.1 1.8L13 22.1a2 2 0 0 1-2 0l-8.1-4.8a2 2 0 0 1-1.1-1.8V7.4L12 1.5Z" />
            <path d="m1.8 7.5 10.2 6 10.2-6M12 13.5v8.8" />
        </>
    ),
    xml: (
        <>
            <path d="M5.5 9a6.5 6.5 0 0 1 13 0v7h-13V9Zm2-3L6 3m10 3 1.5-3M4 10v5m16-5v5M8 17v3m8-3v3" />
            <circle cx="9" cy="9" r=".65" fill="currentColor" stroke="none" />
            <circle cx="15" cy="9" r=".65" fill="currentColor" stroke="none" />
        </>
    ),
    ios: (
        <path
            transform="translate(0 -2) scale(.9)"
            d="M12.2 7.2c.7 0 1.6-.5 2-1.1.4-.5.7-1.3.6-2.1-.7 0-1.6.5-2.1 1.1-.4.5-.7 1.3-.5 2.1Zm4.5 6.1c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.7.8-3.4.8-.7 0-1.8-.8-3-.8-1.6 0-3.1 1-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.5.8 1.1 1.7 2.4 2.9 2.3 1.1 0 1.6-.7 3-.7s1.8.7 3 .7c1.2 0 2-1.1 2.8-2.3.9-1.3 1.2-2.6 1.2-2.7-.1 0-2.4-.9-2.4-3.9Z"
        />
    ),
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
