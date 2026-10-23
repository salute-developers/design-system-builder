// Глифы `uiIcon` прототипа (app.js, UI_GLYPHS), которые нужны разделу «Отступы, радиусы и тени».
const GLYPHS = {
    add: <path d="M12 5v14M5 12h14" />,
    search: (
        <>
            <circle cx="11" cy="11" r="6" />
            <path d="m15.5 15.5 4 4" />
        </>
    ),
    jump: (
        <>
            <path d="M5 5v6a4 4 0 0 0 4 4h9" />
            <path d="m14.5 11 4 4-4 4" />
        </>
    ),
    delete: <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />,
} as const;

export type GlyphName = keyof typeof GLYPHS;

export const StGlyph = ({ name }: { name: GlyphName }) => (
    <svg className="ui-glyph" viewBox="0 0 24 24" aria-hidden="true">
        {GLYPHS[name]}
    </svg>
);
