ARG BASE_IMAGE=plasma/android-runner-compose:dev
FROM ${BASE_IMAGE}

COPY publish-entrypoint.sh /usr/local/bin/publish-entrypoint.sh
RUN chmod +x /usr/local/bin/publish-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/publish-entrypoint.sh"]