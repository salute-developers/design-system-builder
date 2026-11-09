import { useState, type ReactNode } from 'react';

import { TyGlyph } from '../../../../components/TyGlyph';

interface InspectorGroupProps {
    title: string;
    /** Кнопки справа в заголовке: фильтр дополнительной группы. */
    actions?: ReactNode;
    /** Дополнительная группа прототипа (`component-variation-type-group`): свёрнута по умолчанию. */
    additional?: boolean;
    className?: string;
    children: ReactNode;
}

/** Сворачиваемая секция инспектора (`component-primary-properties` прототипа): заголовок со стрелкой и строки. */
export const InspectorGroup = ({ title, actions, additional, className = '', children }: InspectorGroupProps) => {
    const [collapsed, setCollapsed] = useState(Boolean(additional));
    const kind = additional ? 'component-variation-type-group' : 'component-primary-properties';

    return (
        <section
            className={`${kind} component-properties-${title.toLowerCase()} ${collapsed ? 'is-collapsed' : ''} ${className}`}
            aria-label={title}
        >
            <header className="component-variation-type-header">
                <button
                    type="button"
                    className="component-variation-type-toggle"
                    aria-expanded={!collapsed}
                    onClick={() => setCollapsed((value) => !value)}
                >
                    <i>
                        <TyGlyph name={collapsed ? 'chevron-right' : 'chevron-down'} />
                    </i>
                    <strong>{title}</strong>
                </button>
                {actions}
            </header>
            {!collapsed && <div className="component-primary-list">{children}</div>}
        </section>
    );
};
