import { inArray } from 'drizzle-orm';
import * as schema from '../../schema';

/**
 * Зависимости компонентов: `compose` — родитель включает дочерний (Tabs → TabItem),
 * `reuse` — стори родителя рендерит чужой компонент с его собственными токенами
 * (кнопки в Toolbar, чипы в ChipGroup), превью подтягивает тему дочернего.
 * Связи глобальные, не зависят от ДС; `order` задаёт порядок дочерних в папке родителя в пакете.
 *
 * Компоненты заданы именами. Пара, у которой одного из компонентов в базе нет, пропускается:
 * так сид одного компонента не требует наличия всех остальных.
 */
type ComponentDep = { parent: string; child: string; type: 'compose' | 'reuse'; order: number };

export const componentDeps: ComponentDep[] = [
    { parent: 'Tabs', child: 'IconTabItem', type: 'compose', order: 1 },
    { parent: 'Tabs', child: 'TabItem', type: 'compose', order: 2 },
    { parent: 'Steps', child: 'StepItem', type: 'compose', order: 1 },
    { parent: 'ChipGroup', child: 'Chip', type: 'reuse', order: 1 },
    { parent: 'ButtonGroup', child: 'Button', type: 'reuse', order: 1 },
    { parent: 'TextFieldGroup', child: 'TextField', type: 'reuse', order: 1 },
    { parent: 'Popover', child: 'Button', type: 'reuse', order: 1 },
    { parent: 'AvatarGroup', child: 'Avatar', type: 'reuse', order: 1 },
    { parent: 'Tooltip', child: 'Button', type: 'reuse', order: 1 },
    { parent: 'Modal', child: 'Button', type: 'reuse', order: 1 },
    { parent: 'Popup', child: 'Button', type: 'reuse', order: 1 },
    { parent: 'Sheet', child: 'Button', type: 'reuse', order: 1 },
    { parent: 'Dropdown', child: 'Button', type: 'reuse', order: 1 },
    { parent: 'SegmentGroup', child: 'SegmentItem', type: 'reuse', order: 1 },
    { parent: 'SegmentItem', child: 'SegmentGroup', type: 'reuse', order: 1 },
    { parent: 'SegmentGroup', child: 'Counter', type: 'reuse', order: 2 },
    { parent: 'SegmentItem', child: 'Counter', type: 'reuse', order: 2 },
    { parent: 'Toolbar', child: 'Button', type: 'reuse', order: 1 },
    { parent: 'Drawer', child: 'Button', type: 'reuse', order: 1 },
    { parent: 'Toast', child: 'Button', type: 'reuse', order: 1 },
    { parent: 'Notification', child: 'Button', type: 'reuse', order: 1 },
];

export async function seedComponentDeps(db: any) {
    const names = [...new Set(componentDeps.flatMap((dep) => [dep.parent, dep.child]))];
    const rows: { id: string; name: string }[] = await db
        .select({ id: schema.components.id, name: schema.components.name })
        .from(schema.components)
        .where(inArray(schema.components.name, names));
    const idByName = new Map(rows.map((row) => [row.name, row.id]));

    const values = componentDeps
        .filter((dep) => idByName.has(dep.parent) && idByName.has(dep.child))
        .map((dep) => ({
            parentId: idByName.get(dep.parent)!,
            childId: idByName.get(dep.child)!,
            type: dep.type,
            order: dep.order,
        }));

    if (values.length === 0) {
        console.log('  component_deps: 0 rows');
        return [];
    }

    const inserted = await db.insert(schema.componentDeps).values(values).onConflictDoNothing().returning();
    console.log(`  component_deps: ${inserted.length} new of ${values.length}`);
    return inserted;
}
