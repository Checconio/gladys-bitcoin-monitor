FROM node:24-alpine

ARG GLADYS_INTEGRATION_MANIFEST

RUN apk add --no-cache dumb-init

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY index.js ./
COPY src ./src
COPY gladys-assistant-integration.json ./

RUN node -e 'const fs = require("node:fs"); const file = JSON.parse(fs.readFileSync("gladys-assistant-integration.json", "utf8")); const label = JSON.parse(process.argv[1]); if (JSON.stringify(file) !== JSON.stringify(label)) throw new Error("The embedded Gladys manifest does not match the manifest file");' "$GLADYS_INTEGRATION_MANIFEST"

LABEL io.gladysassistant.manifest="$GLADYS_INTEGRATION_MANIFEST"

ENV NODE_ENV=production

RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]

USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "index.js"]
