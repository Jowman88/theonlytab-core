const { Client } = require('pg');
const { Server } = require('socket.io');
const express = require('express');
const http = require('http');

// 1. Initialiseer Express en de HTTP-server direct
const app = express();
const server = http.createServer(app);

// 2. Configureer Socket.io vlijmscherp met het verplichte cloud-pad en CORS-beveiliging
const io = new Server(server, { 
  path: "/socket.io/", // FIX: Dit dwingt de proxy van Render om WebSocket-verkeer direct door te laten!
  cors: { 
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true,
  transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 10000; // Matcht automatisch met de poort van Render

// Gezonde hoofdroute (Health Check)
app.get('/', (req, res) => {
  res.status(200).send('The Only Tab Streaming Core is Active and Running!');
});

// Luisteraar voor inkomende WebSocket-verbindingen
io.on('connection', (socket) => {
  console.log(`New client successfully connected via secure WebSocket: ${socket.id}`);
  
  // Stuur direct bij verbinding een testframe of statusprikkel naar de client
  socket.emit('status', { engine: 'online' });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// 3. Start de database-lus op de achtergrond
async function startDatabaseSync() {
  const dbConfig = {
  user: 'postgres',
  host: 'aws-0-eu-central-1.pooler.supabase.co', // FIX: Change to .co!
  database: 'postgres',
  password: 'postgres.fvqeeriisoediuwbftvh:MidVmXksB2TFPSwB', 
  port: 6543,
  ssl: true
};
  
  try {
    const pgClient = new Client(dbConfig);
    await pgClient.connect();
    console.log("Database connection handshake successful via IPv4 Pooler!");

    // Hou de Node.js thread permanent actief en stream dummy data als er geen actieve tab is
    setInterval(async () => {
      try {
        // Zodra Puppeteer actief is, schieten we hier io.emit('v-frame', ...) door!
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
  startDatabaseSync();
});
