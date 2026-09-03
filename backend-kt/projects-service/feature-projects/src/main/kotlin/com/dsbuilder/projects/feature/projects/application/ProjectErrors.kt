package com.dsbuilder.projects.feature.projects.application

internal sealed class ProjectServiceException(message: String) : RuntimeException(message)

internal class ProjectNotFoundException(projectId: String) :
    ProjectServiceException("Project '$projectId' was not found")

internal class ForbiddenProjectActionException(message: String) :
    ProjectServiceException(message)

internal class InvalidProjectRequestException(message: String) :
    ProjectServiceException(message)

internal class AccessKeyNotFoundException(projectId: String, keyId: String) :
    ProjectServiceException("Access key '$keyId' was not found in project '$projectId'")

internal class RegisteredIdentityUserNotFoundException(email: String) :
    ProjectServiceException("Registered user with email '$email' was not found")

internal open class IdentityProviderException(message: String) :
    ProjectServiceException(message)

internal class IdentityProviderUnavailableException :
    IdentityProviderException("Identity provider is temporarily unavailable")
