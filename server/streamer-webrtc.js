const { Client } = require('pg');
const { Server } = require('socket.io');
const http = require('http');

// Maak een robuuste HTTP-server aan die luistert naar ELK inkomend verzoek van Railway
const server = http.createServer((req, res) => {
  // Voeg expliciete CORS-headers toe om de 502/browser-blokkades direct te slopen
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('The Only Tab Streaming Core is Running Alive\n');
});

// Dwing de poort om vlijmscherp te luisteren naar de dynamische poort van Railway
const PORT = process.env.PORT || 8080;
const io = new Server(server, { 
  cors: { 
    origin: "*",
    methods: ["GET", "POST"]
  } 
});

console.log(`Streaming core initialization on port ${PORT}`);

async function startStreamingEngine() {
  try {
    // Start de database-lus via de IPv4 pooler
    const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
    await pgClient.connect();
    console.log("Database connection handshake successful via IPv4 Pooler!");

    // Hou de Node.js thread permanent actief en open
    setInterval(async () => {
      // De actieve database loop ticker
    }, 5000);

    // Let op: we sluiten pgClient.end() hier niet direct af, zodat de verbinding OPEN blijft!
  } catch (err) {
    console.error("Runtime Database Sync Error:", err.message);
  }
}

startStreamingEngine();

// Dwing de server om te binden op het universele IPv4-adres '0.0.0.0' in plaats van localhost
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server fully bound and locked on port ${PORT}`);
});
