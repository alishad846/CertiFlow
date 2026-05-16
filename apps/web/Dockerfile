FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json tsconfig.base.json ./
COPY apps/web/package*.json apps/web/tsconfig.json apps/web/next.config.mjs apps/web/postcss.config.mjs apps/web/tailwind.config.cjs ./apps/web/
COPY packages/shared/package*.json packages/shared/tsconfig.json ./packages/shared/

RUN npm install

COPY . .

RUN npm run build --workspace @certiflow/shared && npm run build --workspace @certiflow/web

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace", "@certiflow/web"]
