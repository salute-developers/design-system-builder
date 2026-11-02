# syntax=docker/dockerfile:1
FROM gradle:9.1.0-jdk17 AS builder
USER root
WORKDIR /workspace
COPY authorization authorization
COPY backend-kt/gradle backend-kt/gradle
COPY backend-kt/build-system backend-kt/build-system
COPY backend-kt/authorization-core backend-kt/authorization-core
COPY backend-kt/runtime-contracts backend-kt/runtime-contracts
COPY backend-kt/identity-gateway backend-kt/identity-gateway
COPY backend-kt/projects-service backend-kt/projects-service
COPY backend-kt/ds-service backend-kt/ds-service
COPY backend-kt/documentation-service backend-kt/documentation-service
COPY backend-kt/app backend-kt/app
RUN --mount=type=cache,target=/home/gradle/.gradle GRADLE_USER_HOME=/home/gradle/.gradle gradle -p backend-kt/app shadowJar --no-daemon --build-cache --max-workers=1 \
    -Dorg.gradle.jvmargs="-Xmx2g -Dfile.encoding=UTF-8" -Pkotlin.compiler.execution.strategy=in-process \
    --project-cache-dir /workspace/.gradle-project-cache

FROM eclipse-temurin:17-jre-jammy
RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd --system dsbuilder && useradd --system --gid dsbuilder --home /app dsbuilder && \
    mkdir -p /app/authorization /var/tmp/documentation && \
    chown -R dsbuilder:dsbuilder /app /var/tmp/documentation
WORKDIR /app
COPY --from=builder --chown=dsbuilder:dsbuilder /workspace/backend-kt/app/build/libs/*-all.jar /app/backend.jar
COPY --from=builder --chown=dsbuilder:dsbuilder /workspace/authorization /app/authorization
ENV AUTHORIZATION_POLICY_PATH=/app/authorization/policy.json
ENV PROJECT_AUTHORIZATION_POLICY_PATH=/app/authorization/policy.json
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=60.0"
USER dsbuilder
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=10 \
    CMD curl -fsS http://127.0.0.1:8080/ready >/dev/null || exit 1
ENTRYPOINT ["java", "-jar", "/app/backend.jar"]
