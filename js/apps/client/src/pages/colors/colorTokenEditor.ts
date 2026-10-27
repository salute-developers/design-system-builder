import { colorTokenActions, gradientTokenActions } from '../../actions';
import { getDraftAutosaveRevision, recordDraftSave, setDraftAutosaveActivity } from '../../api/draftAutosaveActivity';
import { observeSubjectAddresses } from '../../api/subjectRevisions';
import { authService } from '../../api/authService';
import { getAdditionalColorValues } from '../../actions/colors';
import { AndroidColor, ColorToken, IOSColor, WebColor } from '../../controllers';
import type { DesignSystem, GradientToken, Theme } from '../../controllers';
import {
    COLOR_CONTEXTS,
    COLOR_MODES,
    ColorTokenOperationError,
    camelTokenName,
    contextSubgroup,
    createColorTokenAutosave,
    createHttpColorTokenRepository,
    createHttpTokenGroupRepository,
    familyCreateMembers,
    familyTokens,
    familyUpdate,
    fieldsInheritingFrom,
    inheritedMode,
    legacyDraftFamilies,
    newTokenMembers,
    parseMemberName,
    splitTopLevel,
    tokenId,
    type ColorContext,
    type ColorMode,
    type ColorTokenAutosave,
    type ColorTokenContext,
    type ColorTokenFamilyDto,
    type ColorTokenKey,
    type ColorTokenRepository,
    type ColorTokenView,
    type PlacedDefinition,
    type StateValue,
    type TokenDefinitions,
    type TokenGroupDto,
    type TokenGroupRepository,
    type TokenPlacement,
    type UpdateTokenGroupInput,
} from '../../modules/colorTokens';
import { formatPaletteReference, parsePaletteReference } from '../../modules/palette';
import { draftEntriesOfTypes, removeDraftEntries } from '../../utils/designSystemDraft';

/** Поле значения: `light`, `dark` или `<context>-<mode>`. */
export type FieldId = ColorMode | `${ColorContext}-${ColorMode}`;

export const parseField = (field: FieldId): { context: ColorContext | null; mode: ColorMode } => {
    const [first, second] = field.split('-') as [string, string | undefined];
    return second
        ? { context: first as ColorContext, mode: second as ColorMode }
        : { context: null, mode: first as ColorMode };
};

const PLATFORMS = ['web', 'ios', 'android'] as const;

/** `#RRGGBB` из HEX любой длины без альфа-канала. */
export const rgbHex = (value: string) => {
    const digits = value.trim().replace('#', '');
    const full = digits.length <= 4 ? [...digits.slice(0, 3)].map((c) => c + c).join('') : digits.slice(0, 6);
    return `#${full.toUpperCase()}`;
};

const camel = camelTokenName;

/** Значения состояний нового токена: тот же расчёт, что при правке существующего. */
export const stateValue: StateValue = (value, group, subgroup, mode, state) => {
    if (state === 'brightness') return value;
    const values = getAdditionalColorValues(value, mode, group, subgroup);
    return values ? values[state === 'active' ? 0 : 1] : value;
};

/** Сессия цветовых токенов темы: живёт дольше экрана, чтобы пережить перезагрузку темы после конфликта. */
export interface ColorTokenSession {
    context: ColorTokenContext;
    autosave: ColorTokenAutosave;
    definitions: TokenDefinitions;
    theme: Theme | null;
    designSystem: DesignSystem | null;
    /** Конфликт ревизии, после которого тема перезагружена; сбрасывается «Повторить». */
    conflict: ColorTokenOperationError | null;
    /** Значения несохранённых токенов на момент перезагрузки темы: имя → тип и значения платформ. */
    overlay: Map<string, { type: ColorTokenKey['type']; values: Record<string, unknown> }> | null;
    /** Имена определений из последней загрузки темы: определения, пропавшие из новой загрузки, удаляются. */
    loadedNames: Set<string>;
    /**
     * Определения (имя с режимом), изменённые на этом экране и ещё не сохранённые, по ключу токена. После
     * перезагрузки темы накладываются только они: правки того же токена из другого места не затираются.
     */
    edited: Map<string, Set<string>>;
    /** Группы и подгруппы токенов дизайн-системы. */
    groups: TokenGroupDto[];
    /** Место определения (имя без режима) в группах и признак публикации. */
    placements: Map<string, TokenPlacement>;
    reload: () => void;
    listeners: Set<() => void>;
}

const sessions = new Map<string, ColorTokenSession>();
const confirmedValues = new WeakMap<ColorTokenSession, Map<string, string>>();
const structureReads = new WeakMap<ColorTokenSession, { sync: boolean }>();
const clearSessions = () => {
    sessions.forEach((session) => {
        session.autosave.dispose();
        setDraftAutosaveActivity(session.context, 'color-tokens', null);
    });
    sessions.clear();
};
authService.onSessionReset(clearSessions);
const sessionKey = ({ projectId, designSystemId, tenantId, versionId }: ColorTokenContext) =>
    `${projectId}:${designSystemId}:${tenantId}:${versionId ?? ''}`;

let repository: ColorTokenRepository = createHttpColorTokenRepository();
let groupRepository: TokenGroupRepository = createHttpTokenGroupRepository();

/** Подмена порта операций в тестах. */
export const setColorTokenRepository = (value: ColorTokenRepository, groups?: TokenGroupRepository) => {
    repository = value;
    if (groups) groupRepository = groups;
    clearSessions();
};

export const colorTokenRepository = () => repository;

const notify = (session: ColorTokenSession) => session.listeners.forEach((listener) => listener());

/** Сессия темы; создаётся при первом открытии раздела и переиспользуется до смены темы. */
export const colorTokenSession = (context: ColorTokenContext): ColorTokenSession => {
    const key = sessionKey(context);
    const existing = sessions.get(key);
    if (existing) return existing;
    const session: ColorTokenSession = {
        context,
        definitions: new Map(),
        theme: null,
        designSystem: null,
        conflict: null,
        overlay: null,
        loadedNames: new Set(),
        edited: new Map(),
        groups: [],
        placements: new Map(),
        reload: () => undefined,
        listeners: new Set(),
        autosave: undefined as unknown as ColorTokenAutosave,
    };
    session.autosave = createColorTokenAutosave({
        repository: {
            create: (...args) => repository.create(...args),
            updateValues: (...args) => repository.updateValues(...args),
            delete: (...args) => repository.delete(...args),
            move: (...args) => repository.move(...args),
        },
        context,
        revision: {
            get: () => session.designSystem?.getParameters()?.editRevision ?? 0,
            set: (value) => {
                const parameters = session.designSystem?.getParameters();
                if (parameters) parameters.editRevision = value;
            },
        },
        onChange: () => {
            setDraftAutosaveActivity(context, 'color-tokens', session.autosave.overall().state);
            const unsaved = new Set(session.autosave.unsavedKeys());
            [...session.edited.keys()].forEach((key) => unsaved.has(key) || session.edited.delete(key));
            notify(session);
        },
        onConfirmed: (payload) => {
            const confirmed = confirmedValues.get(session) ?? new Map<string, string>();
            const names = new Map([...session.definitions].map(([name, definition]) => [definition.id, name]));
            payload.update.members.forEach((member) =>
                member.values.forEach((value) => {
                    const name = names.get(member.tokenId);
                    if (name) confirmed.set(`${value.mode}.${name}:${value.platform}`, JSON.stringify(value.value));
                }),
            );
            confirmedValues.set(session, confirmed);
        },
        onSaved: () => recordDraftSave(context),
        onConflict: (error) => {
            // Тема изменена в другом месте: несохранённые значения запоминаются, тема перечитывается, повторная
            // отправка — только по «Повторить».
            session.conflict = error;
            session.overlay = captureUnsaved(session);
            notify(session);
            session.reload();
        },
    });
    sessions.set(key, session);
    return session;
};

/** Места определений из ответа сервера: имя без режима → группа, позиция и признак публикации. */
export const setPlacements = (session: ColorTokenSession, definitions: Array<{ name: string } & TokenPlacement>) => {
    session.placements = new Map(
        definitions.map(({ name, groupId, position, publishedIn }) => [name, { groupId, position, publishedIn }]),
    );
};

/**
 * Приводит тему к определениям сервера по идентификаторам: переименованные определения получают новые имена,
 * удалённые уходят из темы. Значения тем не перечитываются.
 */
const syncTheme = (session: ColorTokenSession, definitions: PlacedDefinition[]) => {
    const theme = session.theme;
    const byId = new Map(definitions.map((definition) => [definition.id, definition]));
    for (const [name, definition] of [...session.definitions]) {
        const next = byId.get(definition.id);
        const type = definition.type as ColorTokenKey['type'];
        for (const mode of COLOR_MODES) {
            const token = theme?.getToken(`${mode}.${name}`, type);
            if (!token) continue;
            if (!next) {
                theme?.removeToken(token.getName(), type);
                continue;
            }
            if (next.name === name) continue;
            const renamed = `${mode}.${next.name}`;
            const parsed = parseMemberName(renamed);
            token.setName(renamed);
            token.setTags(renamed.split('.'));
            if (parsed && parsed.subgroup === 'default' && !parsed.state)
                token.setDisplayName(camel({ group: parsed.group, name: parsed.name }));
            else if (token.getDisplayName() === `${mode}.${name}`) token.setDisplayName(renamed);
        }
    }
    session.definitions = new Map(
        definitions
            .filter((definition) => definition.type === 'color' || definition.type === 'gradient')
            .map((definition) => [definition.name, { id: definition.id, type: definition.type }]),
    );
    session.loadedNames = new Set(session.definitions.keys());
};

/** Перечитывает группы и места определений; после операций над структурой приводит к ним тему. */
export const refreshStructure = async (session: ColorTokenSession, sync = false) => {
    const previous = structureReads.get(session);
    const read = { sync: sync || previous?.sync === true };
    structureReads.set(session, read);
    while (structureReads.get(session) === read && sessions.get(sessionKey(session.context)) === session) {
        // Здесь перечитывается структура, не значения: чужая неуспешная очередь
        // не должна превращать уже выполненную команду в ошибку обновления дерева.
        const revision = getDraftAutosaveRevision(session.context);
        // Сначала группы: их инициализация может разложить определения по группам.
        const groups = await groupRepository.list(session.context);
        const definitions = await groupRepository.definitions(session.context);
        if (structureReads.get(session) !== read || sessions.get(sessionKey(session.context)) !== session) return;
        if (getDraftAutosaveRevision(session.context) !== revision) continue;
        if (read.sync) syncTheme(session, definitions);
        adoptGroups(session, groups);
        setPlacements(session, definitions);
        read.sync = false;
        notify(session);
        return;
    }
};

export const adoptGroups = (session: ColorTokenSession, groups: TokenGroupDto[]) => {
    session.groups = groups;
    observeSubjectAddresses(
        session.context,
        'token-group',
        Object.fromEntries(groups.map((group) => [group.id, group.editRevision ?? 0])),
    );
};

/** Значения определений токенов с несохранёнными правками: имя с режимом → значения платформ. */
const captureUnsaved = (session: ColorTokenSession) => {
    const overlay: NonNullable<ColorTokenSession['overlay']> = new Map();
    const theme = session.theme;
    if (!theme) return overlay;
    for (const id of session.autosave.unsavedKeys()) {
        const key = keyOfId(id);
        if (!key) continue;
        const edited = session.edited.get(id);
        // Состояния `-hover` и `-active` пересчитываются из изменённого определения и накладываются вместе с ним.
        const isEdited = (name: string) => !edited || edited.has(name.replace(/-(hover|active)$/, ''));
        for (const token of familyTokens(theme, key)) {
            if (!isEdited(token.getName())) continue;
            overlay.set(token.getName(), {
                type: key.type,
                values: Object.fromEntries(PLATFORMS.map((platform) => [platform, token.getValue(platform as never)])),
            });
        }
    }
    return overlay;
};

/** Наложение несохранённых значений на перезагруженную тему. */
export const applyOverlay = (session: ColorTokenSession, theme: Theme) => {
    if (!session.overlay) return;
    for (const [name, { type, values }] of session.overlay) {
        const token = theme.getToken(name, type);
        if (!token) continue;
        Object.entries(values).forEach(([platform, value]) => token.setValue(platform as never, value as never));
    }
    session.overlay = null;
};

/**
 * Новая тема сессии. Любая перезагрузка темы (конфликт, смена темы и возврат, отброшенный черновик) не теряет
 * несохранённые правки: их значения снимаются со старой темы и накладываются на новую.
 */
export const adoptTheme = (session: ColorTokenSession, theme: Theme) => {
    if (session.theme === theme) return;
    if (session.theme && !session.overlay && session.autosave.hasUnsaved()) session.overlay = captureUnsaved(session);
    session.theme = theme;
    const confirmed = new Map<string, string>();
    for (const type of ['color', 'gradient'] as const)
        for (const token of theme.getTokens(type))
            for (const platform of ['web', 'ios', 'android'] as const) {
                const value = token.getValue(platform as never);
                confirmed.set(
                    `${token.getName()}:${platform}`,
                    JSON.stringify(type === 'gradient' || Array.isArray(value) ? value : [value]),
                );
            }
    confirmedValues.set(session, confirmed);
    applyOverlay(session, theme);
};

/** Отображаемое имя токена из черновика: имя определения Light, если оно задано, иначе имя по ключу. */
const draftDisplayName = (theme: Theme, key: ColorTokenKey) => {
    const name = `light.${key.group}.default.${key.name}`;
    const displayName = theme.getToken(name, key.type)?.getDisplayName();
    return displayName && displayName !== name ? displayName : camel(key);
};

/** Ключ токена по ключу строки дерева `color:text.accent`. */
export const keyOfId = (id: string): ColorTokenKey | null => {
    const match = /^(color|gradient):([^.]+)\.(.+)$/.exec(id);
    return match ? { type: match[1] as ColorTokenKey['type'], group: match[2], name: match[3] } : null;
};

/** Редактор цветовых токенов открытой темы: правки меняют `Theme` и ставятся в очередь автосохранения. */
export const createColorTokenEditor = (session: ColorTokenSession) => {
    const theme = () => {
        if (!session.theme || !session.designSystem) throw new Error('Тема не загружена');
        return { theme: session.theme, designSystem: session.designSystem };
    };

    const schedule = (key: ColorTokenKey, restoreLegacy = false) =>
        session.autosave.schedule(tokenId(key), () => {
            if (!session.theme || session.context.versionId) return null;
            const payload = familyUpdate(session.theme, key, session.definitions);
            if (!payload) return null;
            const names = new Map([...session.definitions].map(([name, definition]) => [definition.id, name]));
            const confirmed = confirmedValues.get(session);
            const members = payload.update.members
                .map((member) => ({
                    ...member,
                    values: member.values.filter(
                        (value) =>
                            restoreLegacy ||
                            confirmed?.get(`${value.mode}.${names.get(member.tokenId)}:${value.platform}`) !==
                                JSON.stringify(value.value),
                    ),
                }))
                .filter((member) => member.values.length > 0);
            return members.length ? { tokenId: payload.tokenId, update: { members } } : null;
        });

    const memberToken = (key: ColorTokenKey, mode: ColorMode, context: ColorContext | null) => {
        const subgroup = context ? contextSubgroup(key.group, context) : 'default';
        return theme().theme.getToken(`${mode}.${key.group}.${subgroup}.${key.name}`, key.type);
    };

    /** Записывает значение определения и пересчитывает его состояния, как старый редактор. */
    const markEdited = (key: ColorTokenKey, name: string) => {
        const id = tokenId(key);
        session.edited.set(id, (session.edited.get(id) ?? new Set()).add(name));
    };

    const write = (key: ColorTokenKey, mode: ColorMode, context: ColorContext | null, value: string) => {
        const { theme: current, designSystem } = theme();
        const token = memberToken(key, mode, context);
        if (!token) return;
        markEdited(key, token.getName());
        const persist = () => schedule(key);
        if (key.type === 'gradient') {
            const layers = splitTopLevel(value);
            gradientTokenActions.updateToken({
                gradient: layers,
                token: token as GradientToken,
                theme: current,
                designSystem,
                persist,
            });
            return;
        }
        const reference = parsePaletteReference(value);
        const hex = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(value.trim());
        const color = reference ? `${reference.type}.${reference.shade}.${reference.step}` : hex ? `#${hex[1]}` : value;
        const opacity = reference ? (reference.opacity ?? 1) : hex?.[2] ? parseInt(hex[2], 16) / 255 : 1;
        colorTokenActions.updateToken({
            color,
            opacity: Math.round(opacity * 100) / 100,
            token: token as ColorToken,
            theme: current,
            designSystem,
            persist,
        });
    };

    return {
        /** Правка поля: значение режима переносится в связанные подтемы, правка подтемы снимает её связь. */
        setField(view: ColorTokenView, field: FieldId, value: string) {
            const { context, mode } = parseField(field);
            write(view.key, mode, context, value);
            if (context) return;
            for (const target of fieldsInheritingFrom(mode)) {
                if (view.contexts[target.context].linked) write(view.key, target.mode, target.context, value);
            }
        },

        /** Новая прозрачность значения: у ссылки — прозрачность ссылки, у HEX — альфа-канал. */
        setOpacity(view: ColorTokenView, field: FieldId, percent: number) {
            const { context, mode } = parseField(field);
            const current = context ? view.contexts[context].values[mode] : view.modes[mode];
            const opacity = Math.max(0, Math.min(100, Math.round(percent))) / 100;
            const reference = parsePaletteReference(current.value);
            const alpha =
                opacity === 1
                    ? ''
                    : Math.round(opacity * 255)
                          .toString(16)
                          .padStart(2, '0')
                          .toUpperCase();
            const next = reference
                ? formatPaletteReference({ ...reference, opacity: opacity === 1 ? null : opacity })
                : `${rgbHex(current.value)}${alpha}`;
            this.setField(view, field, next);
        },

        /** Восстанавливает наследование подтемы от значений режимов. */
        relink(view: ColorTokenView, context: ColorContext) {
            for (const mode of COLOR_MODES) {
                write(view.key, mode, context, view.modes[inheritedMode(context, mode)].value);
            }
        },

        resetContexts(view: ColorTokenView) {
            COLOR_CONTEXTS.forEach((context) => this.relink(view, context));
        },

        /**
         * Заполняет пустые значения неполного токена: уже заданные не меняются, основа — заданные Light и Dark,
         * а при их отсутствии — значения раздела.
         */
        fill(view: ColorTokenView, defaults: Record<ColorMode, string>) {
            const { theme: current } = theme();
            const base = {
                light: view.modes.light.value || defaults.light,
                dark: view.modes.dark.value || defaults.dark,
            };
            const isEmpty = (value: unknown) =>
                value === '' || value == null || (Array.isArray(value) && !value.length);
            for (const member of newTokenMembers(view.key, base, stateValue)) {
                for (const { mode, value } of member.values) {
                    const token = current.getToken(`${mode}.${member.name}`, view.key.type);
                    if (!token) continue;
                    const empty = PLATFORMS.filter((platform) => isEmpty(token.getValue(platform as never)));
                    if (!empty.length) continue;
                    markEdited(view.key, token.getName());
                    if (view.key.type === 'gradient') {
                        // Нативные значения градиента строятся из слоёв web, как при правке.
                        gradientTokenActions.updateToken({
                            gradient: splitTopLevel(value),
                            token: token as GradientToken,
                            theme: current,
                            designSystem: theme().designSystem,
                            persist: () => undefined,
                        });
                        continue;
                    }
                    empty.forEach((platform) => token.setValue(platform as never, value as never));
                }
            }
            schedule(view.key);
        },

        /** Создаёт токен в группе [groupId] на сервере и добавляет его определения в тему. */
        async create(
            key: ColorTokenKey,
            displayName: string,
            defaults: Record<ColorMode, string>,
            groupId: string | null,
        ): Promise<ColorTokenFamilyDto> {
            const members = newTokenMembers(key, defaults, stateValue);
            const family = await session.autosave.run((editRevision) =>
                repository.create(
                    session.context,
                    {
                        type: key.type,
                        group: key.group,
                        name: key.name,
                        displayName,
                        groupId,
                        members: members.map((member) => ({
                            name: member.name,
                            values: member.values.flatMap(({ mode, value }) =>
                                PLATFORMS.map((platform) => ({ platform, mode, paletteId: null, value: [value] })),
                            ),
                        })),
                    },
                    editRevision,
                ),
            );
            const { theme: current } = theme();
            for (const member of members) {
                const id = family.members.find((item) => item.name === member.name)?.tokenId;
                if (id) session.definitions.set(member.name, { id, type: key.type });
                for (const { mode, value } of member.values) {
                    const name = `${mode}.${member.name}`;
                    current.addToken(
                        'color',
                        new ColorToken(
                            {
                                name,
                                tags: name.split('.'),
                                displayName: member.name === `${key.group}.default.${key.name}` ? displayName : name,
                                enabled: true,
                            },
                            { web: new WebColor(value), ios: new IOSColor(value), android: new AndroidColor(value) },
                        ),
                    );
                }
            }
            await refreshStructure(session).catch(() => notify(session));
            return family;
        },

        /** Создаёт группу (`parentId === null`) или подгруппу в конце соседей. */
        async createGroup(parentId: string | null, label: string): Promise<TokenGroupDto> {
            const group = await session.autosave.run((editRevision) =>
                groupRepository.create(session.context, { kind: 'color', parentId, label }, editRevision),
            );
            await refreshStructure(session);
            return group;
        },

        /** Переименование, перестановка или перенос подгруппы; токены перенесённой подгруппы переименовываются. */
        async updateGroup(groupId: string, input: UpdateTokenGroupInput): Promise<TokenGroupDto> {
            const group = await session.autosave.run((editRevision) =>
                groupRepository.update(session.context, groupId, input, editRevision),
            );
            await refreshStructure(session, input.parentId !== undefined);
            return group;
        },

        /** Удаляет группу с подгруппами и токенами во всех темах. */
        async removeGroup(groupId: string) {
            await session.autosave.run((editRevision) =>
                groupRepository
                    .remove(session.context, groupId, editRevision)
                    .then((result) => ({ ...result, value: null })),
            );
            await refreshStructure(session, true);
        },

        /**
         * Переносит токен в группу [groupId] на позицию [position] и при [name] переименовывает его. Возвращает
         * ключ строки токена после операции.
         */
        async move(view: ColorTokenView, groupId: string, position: number, name?: string): Promise<string> {
            const defaultId = session.definitions.get(`${view.key.group}.default.${view.key.name}`)?.id;
            if (!defaultId) throw new ColorTokenOperationError('not-found', 'Токен ещё не сохранён на сервере');
            const family = await session.autosave.run((editRevision) =>
                repository.move(
                    session.context,
                    defaultId,
                    { groupId, position, ...(name ? { name } : {}) },
                    editRevision,
                ),
            );
            session.autosave.forget(tokenId(view.key));
            await refreshStructure(session, true);
            return tokenId({ type: view.key.type, group: family.group, name: family.name });
        },

        /** Удаляет токен на сервере и убирает его определения из темы. */
        async remove(view: ColorTokenView) {
            const defaultId = session.definitions.get(`${view.key.group}.default.${view.key.name}`)?.id;
            if (!defaultId) throw new ColorTokenOperationError('not-found', 'Токен ещё не сохранён на сервере');
            await session.autosave.run((editRevision) =>
                repository
                    .delete(session.context, defaultId, editRevision)
                    .then((result) => ({ ...result, value: null })),
            );
            session.autosave.forget(tokenId(view.key));
            const { theme: current } = theme();
            for (const token of familyTokens(current, view.key)) {
                current.removeToken(token.getName(), view.key.type);
                const parsed = parseMemberName(token.getName());
                if (parsed?.mode) session.definitions.delete(token.getName().slice(parsed.mode.length + 1));
            }
            // Позиции соседей пересчитаны сервером.
            await refreshStructure(session).catch(() => notify(session));
        },

        /** Цветовые и градиентные записи прежнего черновика темы. */
        legacyDraft() {
            const name = session.designSystem?.getName() || '';
            return draftEntriesOfTypes(name, '0.1.0', ['color', 'gradient']);
        },

        /** Сохраняет записи прежнего черновика операциями над токенами и удаляет их из черновика. */
        async saveLegacyDraft() {
            const entries = this.legacyDraft();
            const { theme: current } = theme();
            for (const key of legacyDraftFamilies(entries)) {
                const defaultName = `${key.group}.default.${key.name}`;
                if (session.definitions.has(defaultName)) {
                    schedule(key, true);
                    continue;
                }
                // Токен из черновика уже есть в теме: создаётся с его значениями всех платформ, тема не меняется.
                const family = await session.autosave.run((editRevision) =>
                    repository.create(
                        session.context,
                        {
                            type: key.type,
                            group: key.group,
                            name: key.name,
                            displayName: draftDisplayName(current, key),
                            paletteGroupId: null,
                            members: familyCreateMembers(current, key),
                        },
                        editRevision,
                    ),
                );
                family.members.forEach((member) =>
                    session.definitions.set(member.name, { id: member.tokenId, type: key.type }),
                );
            }
            await session.autosave.flush();
            // Отправка очереди ошибок не бросает: о несохранённых правках говорит её состояние. Черновик
            // очищается только после успешной отправки, иначе его можно сохранить снова.
            const result = session.autosave.overall();
            if (result.state === 'error') throw result.error ?? new Error('Часть правок не сохранена');
            removeDraftEntries(
                session.designSystem?.getName() || '',
                '0.1.0',
                entries.map((entry) => entry.name),
            );
        },

        discardLegacyDraft() {
            const entries = this.legacyDraft();
            removeDraftEntries(
                session.designSystem?.getName() || '',
                '0.1.0',
                entries.map((entry) => entry.name),
            );
            session.reload();
        },

        /** «Повторить»: снимает отметку конфликта и отправляет несохранённые токены. */
        retry(id?: string) {
            session.conflict = null;
            session.autosave.retry(id);
            notify(session);
        },
    };
};

export type ColorTokenEditor = ReturnType<typeof createColorTokenEditor>;
