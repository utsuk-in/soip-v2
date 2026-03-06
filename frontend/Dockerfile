FROM oven/bun:1

WORKDIR /app

# install dependencies first (better caching)
COPY package.json bun.lock* ./
RUN bun install

# copy source
COPY . .

# render provides PORT env variable
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "src/index.ts"]
