const trustedHeaderNames = new Set([
  'x-user-id',
  'x-system-admin',
  'x-actor-type',
  'x-project-id',
  'x-project-role',
  'x-project-key-id',
  'x-project-scopes',
]);

const gatewayOAuthScheme = {
  type: 'oauth2',
  flows: {
    password: {
      // The relative URL is resolved against the Scalar-selected proxy target.
      tokenUrl: 'auth/token',
      scopes: {
        openid: 'OpenID Connect scope',
      },
      'x-scalar-credentials-location': 'body',
      'x-scalar-secret-client-id': 'dsbuilder-api',
      'x-scalar-secret-username': '',
      'x-scalar-secret-password': '',
    },
  },
};

/** Rewrites a service document to the public gateway contract. */
export function transformOpenApi(document, descriptor, servers, requestDefaults = {}) {
  const sourceParameters = document.components?.parameters ?? {};
  const paths = Object.fromEntries(
    Object.entries(document.paths ?? {})
      .filter(([sourcePath]) => sourcePath === descriptor.sourcePrefix || sourcePath.startsWith(`${descriptor.sourcePrefix}/`))
      .map(([sourcePath, pathItem]) => [
        rewritePath(sourcePath, descriptor),
        transformPathItem(pathItem, descriptor, sourceParameters, requestDefaults),
      ]),
  );

  if (Object.keys(paths).length === 0) {
    throw new Error(`No paths match ${descriptor.sourcePrefix} for ${descriptor.id}`);
  }

  const components = structuredClone(document.components ?? {});
  if (descriptor.requiresAuthentication) {
    components.securitySchemes = {
      ...components.securitySchemes,
      GatewayOAuth: gatewayOAuthScheme,
    };
  }
  if (components.parameters) {
    components.parameters = Object.fromEntries(
      Object.entries(components.parameters).filter(([, parameter]) => !isTrustedHeader(parameter)),
    );
  }
  applyProjectIdDefault(components, requestDefaults.projectId);

  return {
    ...structuredClone(document),
    paths,
    components,
    servers,
  };
}

function rewritePath(sourcePath, descriptor) {
  const suffix = sourcePath.slice(descriptor.sourcePrefix.length);
  return `${descriptor.gatewayPrefix}${suffix}`;
}

function transformPathItem(pathItem, descriptor, sourceParameters, requestDefaults) {
  return Object.fromEntries(
    Object.entries(pathItem).map(([key, value]) => {
      if (!isOperation(key)) {
        return [key, value];
      }
      return [key, transformOperation(value, descriptor, sourceParameters, requestDefaults)];
    }),
  );
}

function transformOperation(operation, descriptor, sourceParameters, requestDefaults) {
  const parameters = (operation.parameters ?? []).filter(
    (parameter) => !isTrustedHeaderReference(parameter, sourceParameters),
  );
  if (descriptor.requiresProjectId && !parameters.some(isProjectIdPathParameter)) {
    parameters.unshift({
      name: 'projectId',
      in: 'path',
      required: true,
      schema: {
        type: 'string',
        default: requestDefaults.projectId ?? '',
      },
    });
  }

  return {
    ...structuredClone(operation),
    ...(parameters.length > 0 ? { parameters } : {}),
    ...(descriptor.requiresAuthentication ? { security: [{ GatewayOAuth: ['openid'] }] } : {}),
  };
}

function applyProjectIdDefault(components, projectId) {
  if (!components.parameters?.ProjectIdPath) {
    return;
  }
  components.parameters.ProjectIdPath = {
    ...components.parameters.ProjectIdPath,
    schema: {
      ...components.parameters.ProjectIdPath.schema,
      default: projectId ?? '',
    },
  };
}

function isOperation(key) {
  return ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'].includes(key);
}

function isTrustedHeader(parameter) {
  return parameter.in === 'header' && trustedHeaderNames.has(parameter.name?.toLowerCase());
}

function isTrustedHeaderReference(parameter, sourceParameters) {
  if (isTrustedHeader(parameter)) {
    return true;
  }
  const parameterName = parameter.$ref?.match(/^#\/components\/parameters\/([^/]+)$/)?.[1];
  return parameterName ? isTrustedHeader(sourceParameters[parameterName] ?? {}) : false;
}

function isProjectIdPathParameter(parameter) {
  return parameter.in === 'path' && parameter.name === 'projectId';
}
