FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends libreoffice fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json tsconfig.base.json ./
COPY apps/api/package*.json apps/api/tsconfig.json ./apps/api/
COPY packages/shared/package*.json packages/shared/tsconfig.json ./packages/shared/

RUN npm install

COPY . .

RUN npm run build --workspace @certiflow/shared && npm run build --workspace @certiflow/api

EXPOSE 4000

CMD ["npm", "run", "start", "--workspace", "@certiflow/api"]
