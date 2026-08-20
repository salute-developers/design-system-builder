FROM gradle:9.1.0-jdk17 AS builder
USER root
WORKDIR /workspace
COPY ./gradle ./gradle
COPY ./build-system ./build-system
COPY ./documentation-service ./documentation-service
RUN gradle -p documentation-service :app:shadowJar --no-daemon

FROM eclipse-temurin:17-jre-jammy
RUN groupadd --system documentation && useradd --system --gid documentation --home /app documentation && mkdir -p /app /var/tmp/documentation && chown -R documentation:documentation /app /var/tmp/documentation
COPY --from=builder --chown=documentation:documentation /workspace/documentation-service/app/build/libs/*-all.jar /app/documentation-service.jar
USER documentation
EXPOSE 8084
ENTRYPOINT ["java", "-jar", "/app/documentation-service.jar"]
