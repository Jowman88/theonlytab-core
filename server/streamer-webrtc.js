const { Client } = require('pg');
const { Server } = require('socket.io');
const express = require('express');
const http = require('http');

// Initialiseer Express en koppel de HTTP-server
const app = express();
const server = http.createServer(app);

// Dwing de Socket.io-motor om de WebSocket-handshake vlijmscherp te accepteren
const io = new Server(server, { 
  cors: { 
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'] // Accepteer beide protocollen voor maximale stabiliteit
});

const PORT = process.env.PORT || 8080;

// Zorg voor een gezonde hoofdroute (Health Check)
app.get('/', (req, res) => {
  res.status(200).send('The Only Tab Streaming Core is Active and Running!');
});

console.log(`Streaming core initialization on port ${PORT}`);

async function startStreamingEngine() {
  try {
    const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();
    console.log("Database connection handshake successful via IPv4 Pooler!");

    // Hou de Node.js thread permanent actief en open
    setInterval(async () => {
      // De actieve database loop ticker
    }, 5000);

  } catch (err) {
    console.error("Runtime Database Sync Error:", err.message);
  }
}

startStreamingEngine();

// Dwing de server om te binden op het universele IPv4-adres '0.0.0.0'
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server fully bound and locked on port ${PORT}`);
});
