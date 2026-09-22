# syntax=docker/dockerfile:1

FROM gradle:9.1.0-jdk17 AS builder
USER root
WORKDIR /workspace
COPY ./authorization ./authorization
COPY ./backend-kt/gradle ./backend-kt/gradle
COPY ./backend-kt/build-system ./backend-kt/build-system
COPY ./backend-kt/authorization-core ./backend-kt/authorization-core
COPY ./backend-kt/documentation-service ./backend-kt/documentation-service
RUN gradle -p backend-kt/documentation-service :app:shadowJar --no-daemon --build-cache --project-cache-dir /workspace/.gradle-project-cache

FROM eclipse-temurin:17-jre-jammy
RUN groupadd --system documentation && useradd --system --gid documentation --home /app documentation && mkdir -p /app /var/tmp/documentation && chown -R documentation:documentation /app /var/tmp/documentation
COPY --from=builder --chown=documentation:documentation /workspace/backend-kt/documentation-service/app/build/libs/*-all.jar /app/documentation-service.jar
COPY --from=builder --chown=documentation:documentation /workspace/authorization /app/authorization
ENV PROJECT_AUTHORIZATION_POLICY_PATH=/app/authorization/policy.json
USER documentation
EXPOSE 8084
ENTRYPOINT ["java", "-jar", "/app/documentation-service.jar"]
