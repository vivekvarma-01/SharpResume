FROM node:22-slim

RUN apt-get update && apt-get install -y \
    libgraphite2-3 \
    libharfbuzz0b \
    libfontconfig1 \
    libssl-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

RUN curl --proto '=https' --tlsv1.2 -fsSL https://drop-sh.fullyjustified.net | sh \
    && mv tectonic /usr/local/bin/tectonic \
    && chmod +x /usr/local/bin/tectonic

COPY . .

EXPOSE 3001

CMD ["node", "server.js"]