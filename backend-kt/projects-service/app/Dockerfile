# syntax=docker/dockerfile:1

FROM gradle:9.1.0-jdk17 AS builder

USER root
WORKDIR /workspace

COPY ./gradle ./gradle
COPY ./build-system ./build-system
COPY ./projects-service ./projects-service

RUN gradle -p projects-service :app:shadowJar --no-daemon --build-cache --project-cache-dir /workspace/.gradle-project-cache

FROM eclipse-temurin:17-jre-jammy

EXPOSE 8082

RUN mkdir /app
COPY --from=builder /workspace/projects-service/app/build/libs/*-all.jar /app/projects-service.jar

ENTRYPOINT ["java","-jar","/app/projects-service.jar"]
