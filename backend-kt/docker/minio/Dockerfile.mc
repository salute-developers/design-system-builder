# syntax=docker/dockerfile:1
FROM --platform=$BUILDPLATFORM golang:1.23.6-bookworm AS build
ARG TARGETOS
ARG TARGETARCH
ENV GOTOOLCHAIN=local
WORKDIR /src
RUN git init . \
    && git remote add origin https://github.com/minio/mc.git \
    && git fetch --depth=1 origin refs/tags/RELEASE.2025-04-16T18-13-26Z \
    && git checkout --detach FETCH_HEAD \
    && test "$(git rev-parse HEAD)" = b00526b153a31b36767991a4f5ce2cced435ee8e
# Match this release's Makefile, including GO111MODULE, kqueue and gen-ldflags.
RUN set -eu; mkdir -p /out; \
    ldflags="$(MC_RELEASE=RELEASE go run buildscripts/gen-ldflags.go 2025-04-16T18:13:26Z)"; \
    GO111MODULE=on CGO_ENABLED=0 GOOS="$TARGETOS" GOARCH="$TARGETARCH" \
        go build -trimpath -tags kqueue --ldflags "$ldflags" -o /out/mc; \
    tar --exclude=.git -czf /out/source.tar.gz .

FROM alpine:3.21.3
RUN apk add --no-cache ca-certificates
COPY --from=build /out/mc /usr/bin/mc
COPY --from=build /src/LICENSE /usr/share/licenses/mc/LICENSE
COPY --from=build /out/source.tar.gz /usr/share/mc/source.tar.gz
LABEL org.opencontainers.image.version="RELEASE.2025-04-16T18-13-26Z" \
      org.opencontainers.image.licenses="AGPL-3.0-only" \
      io.minio.upstream.revision="b00526b153a31b36767991a4f5ce2cced435ee8e"
ENTRYPOINT ["mc"]
