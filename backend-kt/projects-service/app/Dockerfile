FROM gradle:9.1.0-jdk17 AS builder

USER root
WORKDIR /workspace
ENV GRADLE_USER_HOME=/root/.gradle

COPY ./gradle ./gradle
COPY ./build-system ./build-system
COPY ./projects-service ./projects-service

RUN mkdir -p /root/.gradle /workspace /tmp/gradle-project-cache && \
    gradle -p projects-service :app:shadowJar --no-daemon --project-cache-dir /tmp/gradle-project-cache

FROM eclipse-temurin:17-jre-jammy

EXPOSE 8082

RUN mkdir /app
COPY --from=builder /workspace/projects-service/app/build/libs/*-all.jar /app/projects-service.jar

ENTRYPOINT ["java","-jar","/app/projects-service.jar"]
