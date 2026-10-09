# syntax=docker/dockerfile:1

FROM gradle:9.1.0-jdk17 AS builder
USER root
WORKDIR /workspace
COPY ./authorization ./authorization
COPY ./backend-kt/gradle ./backend-kt/gradle
COPY ./backend-kt/build-system ./backend-kt/build-system
COPY ./backend-kt/authorization-core ./backend-kt/authorization-core
COPY ./backend-kt/ds-service ./backend-kt/ds-service
RUN gradle -p backend-kt/ds-service :app:shadowJar --no-daemon --build-cache \
    --project-cache-dir /workspace/.gradle-project-cache

FROM eclipse-temurin:17-jre-jammy
RUN apt-get update && apt-get install --yes --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd --system dsservice && useradd --system --gid dsservice --home /app dsservice && \
    mkdir -p /app/authorization && chown -R dsservice:dsservice /app
COPY --from=builder --chown=dsservice:dsservice /workspace/backend-kt/ds-service/app/build/libs/*-all.jar /app/ds-service.jar
COPY --from=builder --chown=dsservice:dsservice /workspace/authorization /app/authorization
ENV AUTHORIZATION_POLICY_PATH=/app/authorization/policy.json
USER dsservice
EXPOSE 8085
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD curl --fail --silent http://localhost:8085/health >/dev/null || exit 1
ENTRYPOINT ["java", "-jar", "/app/ds-service.jar"]
