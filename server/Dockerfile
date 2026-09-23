FROM node:18-slim

# Installeer de vereiste Linux-pakketten zodat Puppeteer/Chrome stabiel kan draaien
RUN apt-get update && apt-get install -y \
    chromium \
    libnss3 \
    libatk-bridge2.0-0 \
    libx11-xcb1 \
    libxcb-dri3-0 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxtst6 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libpango-1-0 Graves-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Maak handmatig een package.json aan met de exact benodigde backend softwarepakketten
RUN echo '{"name":"theonlytab-server","version":"1.0.0","main":"streamer-webrtc.js","dependencies":{"stripe":"^14.0.0","pg":"^8.11.0","socket.io":"^4.7.0","socket.io-client":"^4.7.0","puppeteer":"^22.0.0"}}' > package.json

# Installeer de pakketten op een veilige manier zonder lockfile-eisen
RUN npm install --omit=dev

# Kopieer je streaming-script naar de container
COPY streamer-webrtc.js .

EXPOSE 8080

# Start je WebRTC streamer-script op
CMD ["node", "streamer-webrtc.js"]
