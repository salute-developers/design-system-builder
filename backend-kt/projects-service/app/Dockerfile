# syntax=docker/dockerfile:1

FROM gradle:9.1.0-jdk17 AS builder

USER root
WORKDIR /workspace

COPY ./authorization ./authorization
COPY ./backend-kt/gradle ./backend-kt/gradle
COPY ./backend-kt/build-system ./backend-kt/build-system
COPY ./backend-kt/authorization-core ./backend-kt/authorization-core
COPY ./backend-kt/projects-service ./backend-kt/projects-service

RUN gradle -p backend-kt/projects-service :app:shadowJar --no-daemon --build-cache --project-cache-dir /workspace/.gradle-project-cache

FROM eclipse-temurin:17-jre-jammy

EXPOSE 8082

RUN mkdir /app
COPY --from=builder /workspace/backend-kt/projects-service/app/build/libs/*-all.jar /app/projects-service.jar
COPY --from=builder /workspace/authorization /app/authorization

ENV PROJECT_AUTHORIZATION_POLICY_PATH=/app/authorization/policy.json

ENTRYPOINT ["java","-jar","/app/projects-service.jar"]
