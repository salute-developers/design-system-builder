import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(currentDirectory, '../../..');

/** Service-level source definitions; operations are never listed individually. */
export const serviceSources = [
  {
    id: 'gateway-authentication',
    title: 'Authentication',
    specPath: path.join(
      repositoryRoot,
      'backend-kt/identity-gateway/app/src/main/resources/openapi/public-authentication.yaml',
    ),
    sourcePrefix: '/auth',
    gatewayPrefix: '/auth',
    requiresProjectId: false,
    requiresAuthentication: false,
  },
  {
    id: 'projects',
    title: 'Projects',
    specPath: path.join(
      repositoryRoot,
      'backend-kt/projects-service/app/src/main/resources/openapi/documentation.yaml',
    ),
    sourcePrefix: '/projects',
    gatewayPrefix: '/api/projects',
    requiresProjectId: false,
    requiresAuthentication: true,
  },
  {
    id: 'design-systems',
    title: 'Design systems',
    specPath: path.join(
      repositoryRoot,
      'backend-kt/ds-service/app/src/main/resources/openapi/documentation.yaml',
    ),
    sourcePrefix: '/api/ds',
    gatewayPrefix: '/api/projects/{projectId}/ds',
    requiresProjectId: true,
    requiresAuthentication: true,
  },
  {
    id: 'documentation',
    title: 'Documentation',
    specPath: path.join(
      repositoryRoot,
      'backend-kt/documentation-service/app/src/main/resources/openapi/documentation.yaml',
    ),
    sourcePrefix: '/documentation',
    gatewayPrefix: '/api/projects/{projectId}/documentation',
    requiresProjectId: true,
    requiresAuthentication: true,
  },
];
