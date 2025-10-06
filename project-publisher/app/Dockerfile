FROM eclipse-temurin:17-jre-jammy
EXPOSE 8080:8080
# Установим docker-cli
RUN apt-get update \
    && apt-get install -y --no-install-recommends docker.io wget \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir /app
COPY scripts /app/scripts/
COPY ./build/libs/*-all.jar /app/project-builder.jar
ENTRYPOINT ["java","-jar","/app/project-builder.jar"]