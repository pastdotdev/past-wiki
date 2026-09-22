# The wiki as one container: Next.js standalone server on port 8080.
#
#   docker build -t past-wiki .
#   docker run --rm -p 8080:8080 -e PAST_API_KEY=past_sk_... past-wiki
#
# The only secret is PAST_API_KEY and it is read at runtime, never at build time.
FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
COPY --from=build /src/.next/standalone ./
COPY --from=build /src/.next/static ./.next/static
USER node
EXPOSE 8080
CMD ["node", "server.js"]
