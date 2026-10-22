import { getDraftAutosaveRevision, setDraftAutosaveActivity } from '../../api/draftAutosaveActivity';
import { acceptTokenValueOverridden, observeSubjectAddresses, tokenValueOverridden } from '../../api/subjectRevisions';
import { authService } from '../../api/authService';
import { getAdditionalColorValues } from '../../actions/colors';
import {
    AndroidColor,
    AndroidGradient,
    ColorToken,
    GradientToken,
    IOSColor,
    IOSGradient,
    WebColor,
    WebGradient,
} from '../../controllers';
import type { DesignSystem, Theme, Token } from '../../controllers';
import {
    COLOR_CONTEXTS,
    COLOR_MODES,
    ColorTokenOperationError,
    NATIVE_PLATFORMS,
    camelTokenName,
    contextSubgroup,
    createColorTokenAutosave,
    createHttpColorTokenRepository,
    createHttpTokenGroupRepository,
    deriveNative,
    familyCreateMembers,
    familyTokens,
    familyUpdate,
    fieldsInheritingFrom,
    findColorToken,
    inheritedMode,
    keyOfId,
    legacyDraftFamilies,
    newTokenMembers,
    parseMemberName,
    readPaint,
    tokenId,
    valueKind,
    webLayers,
    writePaint,
    type ColorContext,
    type ColorMode,
    type ColorTokenAutosave,
    type ColorTokenContext,
    type ColorTokenFamilyDto,
    type ColorTokenKey,
    type ColorTokenRepository,
    type ColorTokenType,
    type ColorTokenView,
    type NativePlatform,
    type Paint,
    type PaintPlatform,
    type PlacedDefinition,
    type StateValue,
    type StopColorResolver,
    type TokenDefinitions,
    type TokenGroupDto,
    type TokenGroupRepository,
    type TokenPlacement,
    type UpdateTokenGroupInput,
} from '../../modules/colorTokens';
import { formatPaletteReference, parsePaletteReference } from '../../modules/palette';
import { restorePaletteColor } from '../../palette/activePalette';
import { getNormalizedColor } from '../../utils/color';
import { draftEntriesOfTypes, removeDraftEntries } from '../../utils/designSystemDraft';

export { keyOfId };

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
    // Состояния градиента получают то же значение.
    if (state === 'brightness' || valueKind(webLayers(value)) === 'gradient') return value;
    const values = getAdditionalColorValues(value, mode, group, subgroup);
    return values ? values[state === 'active' ? 0 : 1] : value;
};

/** Цвет стопа в HEX по палитре темы: для цвета шва Conic на Android и нового стопа. */
export const stopResolver =
    (tokenName: string): StopColorResolver =>
    (color) => {
        if (color.startsWith('#')) return color;
        const resolved = restorePaletteColor(color, -1, tokenName);
        return /^#[0-9a-f]{6,8}$/i.test(resolved) ? resolved : null;
    };

/**
 * Хранимое значение из ввода: градиент — массив слоёв; цвет — в форме редактора: ссылка — `[type.shade.step][o]`
 * с прозрачностью до сотых, HEX — `#RRGGBB` с альфой, если она меньше 1. Не цвет возвращается как есть.
 */
const webValue = (value: string): unknown => {
    const layers = webLayers(value);
    if (valueKind(layers) === 'gradient') return layers;
    const trimmed = value.trim();
    const reference = parsePaletteReference(trimmed);
    if (reference) {
        const opacity = Math.round((reference.opacity ?? 1) * 100) / 100;
        return formatPaletteReference({ ...reference, opacity: opacity === 1 ? null : opacity });
    }
    const hex = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(trimmed);
    if (!hex && !/^#[0-9a-f]{3,4}$/i.test(trimmed)) return trimmed;
    const opacity = hex?.[2] ? parseInt(hex[2], 16) / 255 : 1;
    return getNormalizedColor(hex ? `#${hex[1]}` : trimmed, Math.round(opacity * 100) / 100);
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
    /** Значения несохранённых определений на момент перезагрузки темы: имя → значения платформ. */
    overlay: Map<string, { values: Record<string, unknown> }> | null;
    /** Имена определений из последней загрузки темы: определения, пропавшие из новой загрузки, удаляются. */
    loadedNames: Set<string>;
    /**
     * Определения (имя с режимом), изменённые на этом экране и ещё не сохранённые, по ключу токена. После
     * перезагрузки темы накладываются только они: правки того же токена из другого места не затираются.
     */
    edited: Map<string, Set<string>>;
    /**
     * Признаки своего значения платформы, заданные на экране и ещё не подтверждённые сервером: `<имя с
     * режимом>:<платформа>` → признак. Подтверждённые признаки берутся из прочитанного состояния.
     */
    overrides: Map<string, boolean>;
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

/**
 * Своё ли значение у платформы определения темы [themeName]: неподтверждённый признак экрана, иначе признак из
 * прочитанного или подтверждённого состояния.
 */
export const isOverridden = (session: ColorTokenSession, themeName: string, platform: NativePlatform) => {
    const local = session.overrides.get(`${themeName}:${platform}`);
    if (local !== undefined) return local;
    const [mode, ...member] = themeName.split('.');
    const definition = session.definitions.get(member.join('.'));
    return definition ? tokenValueOverridden(session.context, definition.id, platform, mode) : false;
};

/** Значения платформ определения в классе своего типа: при смене типа семейства определение переносится. */
const retyped = (token: Token, type: ColorTokenType): Token => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- тип задаёт класс определения
    const { type: _previous, ...meta } = token.getTokenData();
    const [web, ios, android] = PLATFORMS.map((platform) => token.getValue(platform as never) as never);
    return type === 'gradient'
        ? new GradientToken(meta, {
              web: new WebGradient(web),
              ios: new IOSGradient(ios),
              android: new AndroidGradient(android),
          })
        : new ColorToken(meta, { web: new WebColor(web), ios: new IOSColor(ios), android: new AndroidColor(android) });
};

/**
 * Тип семейства из ответа сервера без перезагрузки: определения темы переносятся в список своего типа со
 * значениями, ключ токена при этом не меняется.
 */
export const adoptFamilyType = (session: ColorTokenSession, key: ColorTokenKey, type: ColorTokenType) => {
    const theme = session.theme;
    if (!theme) return;
    for (const token of familyTokens(theme, key)) {
        if (token.getType() === type) continue;
        theme.removeToken(token.getName(), token.getType() as ColorTokenType);
        theme.addToken(type, retyped(token, type) as never);
    }
    for (const [name, definition] of session.definitions) {
        const parsed = parseMemberName(name);
        if (parsed?.group === key.group && parsed.name === key.name) definition.type = type;
    }
};

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
        overrides: new Map(),
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
        onConfirmed: (payload, result) => {
            const confirmed = confirmedValues.get(session) ?? new Map<string, string>();
            const names = new Map([...session.definitions].map(([name, definition]) => [definition.id, name]));
            payload.update.members.forEach((member) =>
                member.values.forEach((value) => {
                    const name = names.get(member.tokenId);
                    if (name) confirmed.set(`${value.mode}.${name}:${value.platform}`, JSON.stringify(value.value));
                    if (value.platform === 'web') return;
                    const overridden = value.overridden === true;
                    acceptTokenValueOverridden(context, member.tokenId, value.platform, value.mode, overridden);
                    // Признак подтверждён: дальше он читается из подтверждённого состояния, если его не меняли снова.
                    const local = name ? `${value.mode}.${name}:${value.platform}` : null;
                    if (local && session.overrides.get(local) === overridden) session.overrides.delete(local);
                }),
            );
            confirmedValues.set(session, confirmed);
            const name = names.get(payload.tokenId);
            const parsed = name ? parseMemberName(name) : null;
            if (result.type && parsed)
                adoptFamilyType(session, { group: parsed.group, name: parsed.name }, result.type);
        },
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
        for (const mode of COLOR_MODES) {
            const token = theme ? findColorToken(theme, `${mode}.${name}`) : undefined;
            if (!token) continue;
            if (!next) {
                theme?.removeToken(token.getName(), token.getType() as ColorTokenType);
                continue;
            }
            if (next.name === name) continue;
            const renamed = `${mode}.${next.name}`;
            const parsed = parseMemberName(renamed);
            // Неподтверждённые признаки своего значения переходят к новому имени вместе с определением.
            for (const platform of NATIVE_PLATFORMS) {
                const local = session.overrides.get(`${token.getName()}:${platform}`);
                if (local === undefined) continue;
                session.overrides.delete(`${token.getName()}:${platform}`);
                session.overrides.set(`${renamed}:${platform}`, local);
            }
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
                values: Object.fromEntries(PLATFORMS.map((platform) => [platform, token.getValue(platform as never)])),
            });
        }
    }
    return overlay;
};

/** Наложение несохранённых значений на перезагруженную тему. */
export const applyOverlay = (session: ColorTokenSession, theme: Theme) => {
    if (!session.overlay) return;
    for (const [name, { values }] of session.overlay) {
        const token = findColorToken(theme, name);
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
            for (const platform of PLATFORMS) {
                const value = token.getValue(platform as never);
                confirmed.set(`${token.getName()}:${platform}`, JSON.stringify(Array.isArray(value) ? value : [value]));
            }
    confirmedValues.set(session, confirmed);
    applyOverlay(session, theme);
};

/** Отображаемое имя токена из черновика: имя определения Light, если оно задано, иначе имя по ключу. */
const draftDisplayName = (theme: Theme, key: ColorTokenKey) => {
    const name = `light.${key.group}.default.${key.name}`;
    const displayName = findColorToken(theme, name)?.getDisplayName();
    return displayName && displayName !== name ? displayName : camel(key);
};

/** Значения платформ определения: web и свои значения iOS и Android (без построенных из web). */
interface MemberPaint {
    web: unknown;
    own: Partial<Record<NativePlatform, unknown>>;
}

/** Редактор цветовых токенов открытой темы: правки меняют `Theme` и ставятся в очередь автосохранения. */
export const createColorTokenEditor = (session: ColorTokenSession) => {
    const theme = () => {
        if (!session.theme || !session.designSystem) throw new Error('Тема не загружена');
        return { theme: session.theme, designSystem: session.designSystem };
    };

    const schedule = (key: ColorTokenKey, restoreLegacy = false) =>
        session.autosave.schedule(tokenId(key), () => {
            if (!session.theme || session.context.versionId) return null;
            const payload = familyUpdate(session.theme, key, session.definitions, (name, platform) =>
                isOverridden(session, name, platform),
            );
            if (!payload) return null;
            const names = new Map([...session.definitions].map(([name, definition]) => [definition.id, name]));
            const confirmed = confirmedValues.get(session);
            // В очередь идут значения и признаки своего значения, которые отличаются от подтверждённых.
            const members = payload.update.members
                .map((member) => ({
                    ...member,
                    values: member.values.filter(
                        (value) =>
                            restoreLegacy ||
                            confirmed?.get(`${value.mode}.${names.get(member.tokenId)}:${value.platform}`) !==
                                JSON.stringify(value.value) ||
                            (value.platform !== 'web' &&
                                (value.overridden === true) !==
                                    tokenValueOverridden(session.context, member.tokenId, value.platform, value.mode)),
                    ),
                }))
                .filter((member) => member.values.length > 0);
            return members.length ? { tokenId: payload.tokenId, update: { members } } : null;
        });

    const memberToken = (key: ColorTokenKey, mode: ColorMode, context: ColorContext | null) => {
        const subgroup = context ? contextSubgroup(key.group, context) : 'default';
        return findColorToken(theme().theme, `${mode}.${key.group}.${subgroup}.${key.name}`);
    };

    const markEdited = (key: ColorTokenKey, name: string) => {
        const id = tokenId(key);
        session.edited.set(id, (session.edited.get(id) ?? new Set()).add(name));
    };

    /** Своё значение и web определения. */
    const paintOf = (token: Token): MemberPaint => ({
        web: token.getValue('web' as never),
        own: Object.fromEntries(
            NATIVE_PLATFORMS.filter((platform) => isOverridden(session, token.getName(), platform)).map((platform) => [
                platform,
                token.getValue(platform as never),
            ]),
        ),
    });

    /** Значения платформ определения: свои значения как есть, остальные — построенные из web. */
    const applyPaint = (token: Token, { web, own }: MemberPaint) => {
        token.setValue('web' as never, web as never);
        for (const platform of NATIVE_PLATFORMS) {
            const ownValue = own[platform];
            const value =
                ownValue !== undefined ? ownValue : deriveNative(web, platform, stopResolver(token.getName()));
            token.setValue(platform as never, value as never);
            // Неподтверждённым остаётся только признак, который отличается от прочитанного состояния: без
            // неподтверждённого признака `isOverridden` возвращает прочитанный.
            const flag = ownValue !== undefined;
            const local = `${token.getName()}:${platform}`;
            session.overrides.delete(local);
            if (flag !== isOverridden(session, token.getName(), platform)) session.overrides.set(local, flag);
        }
    };

    /**
     * Значение определения и его состояния `-hover` и `-active`: у цвета состояние — расчёт редактора от значения
     * платформы, у градиента — то же значение. Без новой web-основы состояние сохраняет своё web-значение, и
     * платформы без своей строки строятся из него, а не из основного цвета. Признак своего значения у состояний —
     * как у определения.
     */
    const writeField = (key: ColorTokenKey, mode: ColorMode, token: Token | undefined, paint: MemberPaint) => {
        if (!token) return;
        markEdited(key, token.getName());
        const webChanged = JSON.stringify(token.getValue('web' as never)) !== JSON.stringify(paint.web);
        applyPaint(token, paint);
        const parsed = parseMemberName(token.getName());
        if (!parsed) return;
        (['active', 'hover'] as const).forEach((state, index) => {
            const target = findColorToken(theme().theme, `${token.getName()}-${state}`);
            if (!target) return;
            // Без формулы состояния web-цвет состояния не пересчитывается.
            const { web, ...own } = Object.fromEntries(
                Object.entries<unknown>({ web: paint.web, ...paint.own }).map(([platform, value]) => {
                    const current = readPaint(value, platform as PaintPlatform);
                    if (current?.kind !== 'color') return [platform, value];
                    const values = getAdditionalColorValues(
                        current.color,
                        mode,
                        parsed.group,
                        parsed.subgroup,
                        token.getName(),
                    );
                    // Без формулы своё значение состояния остаётся своим, как и его web-цвет.
                    return [
                        platform,
                        values ? values[index] : platform === 'web' ? undefined : target.getValue(platform as never),
                    ];
                }),
            );
            const stateWeb = webChanged ? web : target.getValue('web' as never);
            if (stateWeb === undefined) return;
            applyPaint(target, { web: stateWeb, own });
        });
    };

    return {
        /**
         * Хранимое значение платформы поля: web — общее значение (iOS и Android без своих строк перестраиваются),
         * iOS или Android — своё значение этой платформы, `undefined` — своё значение снова строится из web. Новое
         * значение определения переносится в связанные подтемы вместе со своими значениями платформ, правка подтемы
         * снимает её связь.
         */
        setValue(view: ColorTokenView, field: FieldId, platform: PaintPlatform, value: unknown) {
            const { context, mode } = parseField(field);
            const token = memberToken(view.key, mode, context);
            if (!token) return;
            const current = paintOf(token);
            const own = { ...current.own };
            if (platform !== 'web' && value === undefined) delete own[platform];
            else if (platform !== 'web') own[platform] = value;
            const next = { web: platform === 'web' ? value : current.web, own };
            writeField(view.key, mode, token, next);
            if (!context)
                for (const target of fieldsInheritingFrom(mode)) {
                    if (view.contexts[target.context].linked)
                        writeField(view.key, target.mode, memberToken(view.key, target.mode, target.context), next);
                }
            schedule(view.key);
        },

        /** Правка значения поля строкой: HEX, ссылка или слои градиента. */
        setField(view: ColorTokenView, field: FieldId, value: string) {
            this.setValue(view, field, 'web', webValue(value));
        },

        /** Значение выбора цвета для платформы. */
        setPaint(view: ColorTokenView, field: FieldId, platform: PaintPlatform, paint: Paint) {
            const value = writePaint(paint, platform);
            this.setValue(view, field, platform, typeof value === 'string' ? webValue(value) : value);
        },

        /**
         * Строка своего значения платформы: копия значения, построенного из web. Только у полей режимов: подтема
         * получает строки платформ наследованием от режима.
         */
        addPlatform(view: ColorTokenView, field: FieldId, platform: NativePlatform) {
            const { context, mode } = parseField(field);
            const token = context ? undefined : memberToken(view.key, mode, null);
            if (!token) return;
            const web = token.getValue('web' as never);
            this.setValue(view, field, platform, deriveNative(web, platform, stopResolver(token.getName())));
        },

        /**
         * «×» у строки платформы: значение снова строится из web. У связанной подтемы строка наследуется от режима и
         * убирается только у поля режима, поэтому вызов в обход интерфейса ничего не меняет.
         */
        removePlatform(view: ColorTokenView, field: FieldId, platform: NativePlatform) {
            const { context } = parseField(field);
            if (context && view.contexts[context].linked) return;
            this.setValue(view, field, platform, undefined);
        },

        /** Новая прозрачность значения: у ссылки — прозрачность ссылки, у HEX — альфа-канал. */
        setOpacity(view: ColorTokenView, field: FieldId, percent: number, platform: PaintPlatform = 'web') {
            const { context, mode } = parseField(field);
            const base = context ? view.contexts[context].values[mode] : view.modes[mode];
            const current = platform === 'web' ? base : base.platforms[platform];
            if (!current) return;
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
            this.setValue(view, field, platform, webValue(next));
        },

        /** Восстанавливает наследование подтемы от значений режимов вместе со своими значениями платформ. */
        relink(view: ColorTokenView, context: ColorContext) {
            for (const mode of COLOR_MODES) {
                const source = memberToken(view.key, inheritedMode(context, mode), null);
                if (source) writeField(view.key, mode, memberToken(view.key, mode, context), paintOf(source));
            }
            schedule(view.key);
        },

        resetContexts(view: ColorTokenView) {
            COLOR_CONTEXTS.forEach((context) => this.relink(view, context));
        },

        /**
         * Заполняет пустые значения неполного токена: уже заданные не меняются, основа — заданные Light и Dark,
         * а при их отсутствии — значения раздела. Пустые значения iOS и Android строятся из web.
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
                    const token = findColorToken(current, `${mode}.${member.name}`);
                    if (!token) continue;
                    const empty = PLATFORMS.filter((platform) => isEmpty(token.getValue(platform as never)));
                    if (!empty.length) continue;
                    markEdited(view.key, token.getName());
                    if (empty.includes('web')) token.setValue('web' as never, webValue(value) as never);
                    const web = token.getValue('web' as never);
                    for (const platform of NATIVE_PLATFORMS)
                        if (empty.includes(platform))
                            token.setValue(
                                platform as never,
                                deriveNative(web, platform, stopResolver(token.getName())) as never,
                            );
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
                        type: 'color',
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
            const type: ColorTokenType = family.type === 'gradient' ? 'gradient' : 'color';
            for (const member of members) {
                const id = family.members.find((item) => item.name === member.name)?.tokenId;
                if (id) session.definitions.set(member.name, { id, type });
                for (const { mode, value } of member.values) {
                    const name = `${mode}.${member.name}`;
                    const token = new ColorToken(
                        {
                            name,
                            tags: name.split('.'),
                            displayName: member.name === `${key.group}.default.${key.name}` ? displayName : name,
                            enabled: true,
                        },
                        { web: new WebColor(value), ios: new IOSColor(value), android: new AndroidColor(value) },
                    );
                    current.addToken(type, (type === 'color' ? token : retyped(token, type)) as never);
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
            return tokenId({ group: family.group, name: family.name });
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
                current.removeToken(token.getName(), token.getType() as ColorTokenType);
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
                            type: familyTokens(current, key).some((token) => token.getType() === 'gradient')
                                ? 'gradient'
                                : 'color',
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
                    session.definitions.set(member.name, { id: member.tokenId, type: family.type }),
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
