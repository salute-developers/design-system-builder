# syntax=docker/dockerfile:1
FROM --platform=$BUILDPLATFORM golang:1.24.2-bookworm AS build
ARG TARGETOS
ARG TARGETARCH
ENV GOTOOLCHAIN=local
WORKDIR /src
# Fetch the annotated release tag and verify its peeled commit before compiling.
RUN git init . \
    && git remote add origin https://github.com/minio/minio.git \
    && git fetch --depth=1 origin refs/tags/RELEASE.2025-04-22T22-12-26Z \
    && git checkout --detach FETCH_HEAD \
    && test "$(git rev-parse HEAD)" = 0d7408fc9969caf07de6a8c3a84f9fbb10a6739e
# Keep gen-ldflags on the build host; only the final binary is cross-compiled.
# These flags match this release's Makefile build target. The timestamp must
# be explicit: a release tag's timestamp can differ from its commit timestamp.
RUN set -eu; mkdir -p /out; \
    ldflags="$(MINIO_RELEASE=RELEASE go run buildscripts/gen-ldflags.go 2025-04-22T22:12:26Z)"; \
    CGO_ENABLED=0 GOOS="$TARGETOS" GOARCH="$TARGETARCH" \
        go build -tags kqueue -trimpath --ldflags "$ldflags" -o /out/minio; \
    tar --exclude=.git -czf /out/source.tar.gz .

FROM alpine:3.21.3
# curl and /bin/sh are required by the existing compose healthcheck.
RUN apk add --no-cache ca-certificates curl
COPY --from=build /out/minio /usr/bin/minio
COPY --from=build /src/LICENSE /usr/share/licenses/minio/LICENSE
COPY --from=build /out/source.tar.gz /usr/share/minio/source.tar.gz
LABEL org.opencontainers.image.version="RELEASE.2025-04-22T22-12-26Z" \
      org.opencontainers.image.licenses="AGPL-3.0-only" \
      io.minio.upstream.revision="0d7408fc9969caf07de6a8c3a84f9fbb10a6739e"
EXPOSE 9000 9001
ENTRYPOINT ["minio"]
