# Supply the approved Node+SWI+Python/Pillow base by its immutable digest.
ARG HARBOR_BASE_IMAGE
FROM ${HARBOR_BASE_IMAGE}
USER root
WORKDIR /opt/harbor
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY src ./src
COPY server ./server
COPY scripts ./scripts
COPY vendor ./vendor
RUN mkdir -p .data && chown -R 1000:1000 /opt/harbor
USER 1000:1000
ENV NODE_ENV=production SWIPL=swipl HARBOR_PYTHON=python3
ENTRYPOINT []
CMD ["node","--import","tsx","server/public.ts"]
