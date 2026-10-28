FROM node:24.22.1-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53

RUN node -e 'const [major, minor, patch] = process.versions.node.split(".").map(Number); if (major !== 24 || minor < 22 || (minor === 22 && patch < 1) || !process.release.lts) throw new Error("Node 24 LTS >=24.22.1 required");'

ARG GLADYS_INTEGRATION_MANIFEST

RUN apk add --no-cache dumb-init

WORKDIR /app

COPY package.json package-lock.json ./
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
