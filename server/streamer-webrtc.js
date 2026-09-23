const { Client } = require('pg');
const { Server } = require('socket.io');
const express = require('express');
const http = require('http');

// 1. Initialiseer Express en de HTTP-server direct
const app = express();
const server = http.createServer(app);

// 2. Configureer Socket.io vlijmscherp voor Railway en Vercel
const io = new Server(server, { 
  cors: { 
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true,
  transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 8080;

// Gezonde hoofdroute (Health Check) zodat Railway DIRECT ziet dat de app leeft
app.get('/', (req, res) => {
  res.status(200).send('The Only Tab Streaming Core is Active and Running!');
});

// Luisteraar voor inkomende WebSocket-verbindingen
io.on('connection', (socket) => {
  console.log(`New client connected to streaming engine: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// 3. Start de database-lus op de achtergrond zonder Express te blokkeren
async function startDatabaseSync() {
  if (!process.env.DATABASE_URL) {
    console.error("CRITICAL ERROR: DATABASE_URL environment variable is missing!");
    return;
  }
  
  try {
    // FIX: De client wordt nu PAS aangemaakt als de functie draait en de URL geladen is!
    const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();
    console.log("Database connection handshake successful via IPv4 Pooler!");

    // Hou de Node.js thread permanent actief en open voor streaming frames
    setInterval(async () => {
      try {
        // Hier schieten we dadelijk de live frames door naar io.emit('v-frame', ...)
      } catch (tickErr) {
        console.error("Tick error:", tickErr.message);
      }
    }, 4000);

  } catch (err) {
    console.error("Runtime Database Sync Error:", err.message);
  }
}

// 4. Start de applicatie op de juiste volgorde
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server fully bound and locked on port ${PORT}`);
  // Start de database pas nadat de poort succesvol openstaat!
  startDatabaseSync();
});
