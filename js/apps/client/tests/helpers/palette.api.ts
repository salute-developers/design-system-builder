import { expect } from '@playwright/test';
import { authenticatedRequest } from './authentication.ts';
import type { Session } from './authentication.ts';

export type PaletteSlot = Readonly<{ type: 'general' | 'additional'; shade: string }>;
export type PaletteStep = Readonly<{ step: number; value: string; overridden: boolean }>;
export type PaletteRamp = Readonly<{
    slot: PaletteSlot;
    displayName: string;
    modified: boolean;
    steps: readonly PaletteStep[];
}>;
export type PaletteGroup = Readonly<{ id: string; label: string; systemKey: string; ramps: readonly PaletteRamp[] }>;
export type ThemePalette = Readonly<{
    tenantId: string;
    editRevision: number;
    groups: readonly PaletteGroup[];
    template: readonly (PaletteSlot & { steps: readonly { step: number; value: string }[] })[];
}>;

export const green: PaletteSlot = { type: 'additional', shade: 'h130' };
export const blue: PaletteSlot = { type: 'additional', shade: 'h200' };

export function paletteGroup(palette: ThemePalette, key: string): PaletteGroup {
    const matches = palette.groups.filter((group) => group.systemKey === key);
    expect(matches, 'Единственная группа палитры ' + key).toHaveLength(1);
    return matches[0]!;
}

export function paletteRamp(group: PaletteGroup, slot: PaletteSlot): PaletteRamp {
    const matches = group.ramps.filter((ramp) => ramp.slot.type === slot.type && ramp.slot.shade === slot.shade);
    expect(matches, 'Точная растяжка ' + group.label + '/' + slot.type + '.' + slot.shade).toHaveLength(1);
    return matches[0]!;
}

export function paletteStep(group: PaletteGroup, slot: PaletteSlot, step: number): PaletteStep {
    const matches = paletteRamp(group, slot).steps.filter((item) => item.step === step);
    expect(matches, 'Точная ступень ' + group.label + '/' + slot.shade + '/' + step).toHaveLength(1);
    return matches[0]!;
}

/** Публичные чтения и подготовка палитры только собственной темы сценария. */
export class PaletteApi {
    readonly url: string;
    private readonly themeId: string;
    private readonly session: Session;

    constructor(gatewayBaseURL: string, projectId: string, themeId: string, session: Session) {
        this.url = new URL(
            `api/projects/${encodeURIComponent(projectId)}/ds/tenants/${encodeURIComponent(themeId)}/palette`,
            gatewayBaseURL,
        ).href;
        this.themeId = themeId;
        this.session = session;
    }

    stepURL(groupId: string, slot: PaletteSlot, step: number): string {
        return (
            this.url +
            `/groups/${encodeURIComponent(groupId)}/ramps/${slot.type}/${encodeURIComponent(slot.shade)}/steps/${step}`
        );
    }

    async get(): Promise<ThemePalette> {
        const raw: unknown = await (await authenticatedRequest(this.session, this.url, 'GET', [200])).json();
        expect(raw, 'Палитра своей темы').toMatchObject({
            tenantId: this.themeId,
            groups: expect.any(Array),
            template: expect.any(Array),
            editRevision: expect.any(Number),
        });
        return raw as ThemePalette;
    }

    async seedStep(groupId: string, slot: PaletteSlot, step: number, value: string): Promise<void> {
        const current = await this.get();
        const response = await authenticatedRequest(this.session, this.stepURL(groupId, slot, step), 'PATCH', [200], {
            value,
            editRevision: current.editRevision,
        });
        await response.arrayBuffer();
    }

    async prepare(): Promise<ThemePalette> {
        const initial = await this.get();
        const required: readonly [string, PaletteSlot][] = [
            ['accent', green],
            ['accent', blue],
            ['status', green],
            ['syntax', green],
            ['neutral', { type: 'general', shade: 'gray' }],
        ];
        for (const [key, slot] of required) {
            const group = paletteGroup(initial, key);
            expect(
                initial.template.filter((item) => item.type === slot.type && item.shade === slot.shade),
                'Шаблон содержит точный слот PAL-BASE',
            ).toHaveLength(1);
            if (!group.ramps.some((ramp) => ramp.slot.type === slot.type && ramp.slot.shade === slot.shade)) {
                const response = await authenticatedRequest(
                    this.session,
                    this.url + `/groups/${encodeURIComponent(group.id)}/ramps`,
                    'POST',
                    [201],
                    { ...slot, editRevision: initial.editRevision },
                );
                await response.arrayBuffer();
            }
        }
        const palette = await this.get();
        for (const [key, slot] of required) {
            const ramp = paletteRamp(paletteGroup(palette, key), slot);
            expect(ramp.modified, 'Новая растяжка совпадает с источником').toBe(false);
            for (const step of [300, 400, 500]) paletteStep(paletteGroup(palette, key), slot, step);
        }
        return palette;
    }
}
