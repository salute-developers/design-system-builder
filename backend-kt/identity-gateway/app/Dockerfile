# syntax=docker/dockerfile:1

FROM gradle:9.1.0-jdk17 AS builder

USER root
WORKDIR /workspace
ENV GRADLE_USER_HOME=/root/.gradle

COPY ./gradle ./gradle
COPY ./build-system ./build-system
COPY ./identity-gateway ./identity-gateway

RUN --mount=type=cache,id=dsb-gradle-user-home,target=/root/.gradle,sharing=locked \
    --mount=type=cache,id=dsb-identity-gateway-project-cache,target=/workspace/.gradle-project-cache,sharing=locked \
    gradle -p identity-gateway :app:shadowJar --no-daemon --build-cache --project-cache-dir /workspace/.gradle-project-cache

FROM eclipse-temurin:17-jre-jammy

EXPOSE 8091

RUN mkdir /app
COPY --from=builder /workspace/identity-gateway/app/build/libs/*-all.jar /app/auth-helper.jar

ENTRYPOINT ["java","-jar","/app/auth-helper.jar"]
