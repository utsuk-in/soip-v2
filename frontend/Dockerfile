FROM oven/bun:1

WORKDIR /app

# build-time API base for Vite-style envs
ARG VITE_API_BASE
ENV VITE_API_BASE=$VITE_API_BASE

# install dependencies first (better caching)
COPY package.json bun.lock* ./
RUN bun install

# copy source
COPY . .

# build static assets with Vite (env injected at build time)
RUN bunx vite build

# render provides PORT env variable
ENV PORT=3000

EXPOSE 3000

# inject runtime API base for browser code, then serve built assets
CMD ["sh", "-c", "printf 'window.__SOIP_CONFIG__ = { API_BASE: \"%s\" };\\n' \"${VITE_API_BASE:-}\" > dist/env.js && bunx vite preview --host 0.0.0.0 --port ${PORT:-3000}"]
