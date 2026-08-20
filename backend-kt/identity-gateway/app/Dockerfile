FROM gradle:9.1.0-jdk17 AS builder

USER root
WORKDIR /workspace
ENV GRADLE_USER_HOME=/root/.gradle

COPY ./gradle ./gradle
COPY ./build-system ./build-system
COPY ./identity-gateway ./identity-gateway

RUN mkdir -p /root/.gradle /workspace /tmp/gradle-project-cache && \
    gradle -p identity-gateway :app:shadowJar --no-daemon --project-cache-dir /tmp/gradle-project-cache

FROM eclipse-temurin:17-jre-jammy

EXPOSE 8091

RUN mkdir /app
COPY --from=builder /workspace/identity-gateway/app/build/libs/*-all.jar /app/auth-helper.jar

ENTRYPOINT ["java","-jar","/app/auth-helper.jar"]
