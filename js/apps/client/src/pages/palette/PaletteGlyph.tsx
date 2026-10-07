// Глифы `uiIcon` прототипа (app.js, UI_GLYPHS) для кнопок раздела.
const GLYPHS = {
    add: <path d="M12 5v14M5 12h14" />,
    search: (
        <>
            <circle cx="11" cy="11" r="6" />
            <path d="m15.5 15.5 4 4" />
        </>
    ),
    delete: <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />,
    pencil: <path d="M4 20h4L19 9a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5Z" />,
    'chevron-down': <path d="m6 9.5 6 5.5 6-5.5" />,
    'chevron-up': <path d="m6 14.5 6-5.5 6 5.5" />,
    inspector: (
        <>
            <rect x="4" y="5" width="16" height="14" rx="2" />
            <path d="M14 5v14" />
        </>
    ),
} as const;

export const PaletteGlyph = ({ name }: { name: keyof typeof GLYPHS }) => (
    <svg className="ui-glyph" viewBox="0 0 24 24" aria-hidden="true">
        {GLYPHS[name]}
    </svg>
);
