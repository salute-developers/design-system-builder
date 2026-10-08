export { ApiError } from '../shared/data/apiRequest';
export { projectsApi } from '../modules/projects/data/projectsApi';
export { themesApi } from '../modules/themes/data/themesApi';

export type {
    Project as ProjectDto,
    ProjectAccessKey as ProjectAccessKeyDto,
    ProjectMember as ProjectMemberDto,
    ProjectMemberCandidate as ProjectMemberCandidateDto,
    CreatedProjectAccessKey as CreatedProjectAccessKeyDto,
    ProjectRole,
} from '../modules/projects/domain/project';
export type { DesignSystem as DesignSystemDto } from '../modules/designSystems/domain/designSystem';
export type {
    ThemePreview as ThemePreviewDto,
    ThemeProfile,
    ThemeTenant as TenantDto,
} from '../modules/themes/domain/theme';

import { designSystemsApi as designSystemsDataApi } from '../modules/designSystems/data/designSystemsApi';
import { themesApi } from '../modules/themes/data/themesApi';

/** @deprecated New modules import design-system and theme repositories separately. */
export const designSystemsApi = {
    ...designSystemsDataApi,
    tenants: themesApi.list,
    createTenant: themesApi.create,
    updateTenant: themesApi.update,
    removeTenant: themesApi.remove,
};
