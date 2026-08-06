FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/figma-plugin/package.json apps/figma-plugin/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci
COPY apps/web apps/web
COPY packages/shared packages/shared
RUN npm run build --workspace=@content-library/web

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
WORKDIR /app
COPY --from=build /app/apps/web/.output ./
USER node
EXPOSE 3000
CMD ["node", "server/index.mjs"]
