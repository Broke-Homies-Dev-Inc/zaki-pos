FROM node:20-bookworm AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:vite

# ---- Production stage ----
FROM node:20-bookworm

WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist
COPY serve.json ./dist/serve.json

EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000", "--config", "serve.json"]
