# Existing approved Node 22.22.2 + SWI 10.0.2 runtime, pinned by immutable image ID.
ARG HARBOR_BASE_IMAGE
FROM ${HARBOR_BASE_IMAGE}
USER root
RUN apt-get update && apt-get install -y --no-install-recommends python3-pil && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/harbor
COPY dist-server/ ./
RUN mkdir -p .data && chown -R 1000:1000 /opt/harbor && node --version && python3 -c 'from PIL import Image; print(Image.__version__)'
USER 1000:1000
ENV NODE_ENV=production SWIPL=swipl HARBOR_PYTHON=python3
ENTRYPOINT []
CMD ["node", "public.mjs"]
