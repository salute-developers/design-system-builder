import type { CoreCompatibilityReport, CoreIssue } from '../../api/coreCompatibilityRepository';
export const context = { projectId: 'project', designSystemId: 'ds', tenantId: 'tenant' };
export const issue: CoreIssue = {
    issueId: 'variation:value:CORE_PROPERTY_REMOVED',
    code: 'CORE_PROPERTY_REMOVED',
    severity: 'blocking',
    location: {
        componentId: 'button',
        componentName: 'Button',
        platform: 'compose',
        appearanceId: 'appearance',
        appearanceName: 'Rounded',
        propertyId: 'old',
        propertyName: 'oldFill',
        valueKind: 'variation',
        valueId: 'value',
        styleIds: ['large', 'accent'],
        styleLabels: ['size=large', 'view=accent'],
        states: ['hovered'],
        revision: 9,
    },
    storedValue: {
        literal: null,
        tokenId: 'token',
        tokenName: 'background.accent',
        alpha: '0.5',
        adjustment: '2',
        targetAppearanceId: null,
        targetStyleIds: [],
        platformAdjustments: [],
    },
    allowedActions: ['remove', 'transfer'],
};
export const report = (item = issue): CoreCompatibilityReport => ({
    context: {
        designSystemId: 'ds',
        versionId: null,
        draftId: 'draft',
        draftRevision: 14,
        coreSelectionRevision: 7,
        coreReleases: [],
    },
    items: [item],
    blockingCount: 1,
    warningCount: 0,
    nextCursor: null,
    validatorVersion: 1,
});
