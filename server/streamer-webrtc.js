import pkg from 'pg';
const { Client } = pkg;
import { Server } from 'socket.io';
import express from 'express';
import http from 'http';
import puppeteer from 'puppeteer';

// 1. Initialiseer Express en de HTTP-server
const app = express();
const server = http.createServer(app);

// 2. Configureer Socket.io vlijmscherp voor Render
const io = new Server(server, { 
  path: "/socket.io/", 
  cors: { 
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket']
});

const PORT = process.env.PORT || 10000;

// Gezonde hoofdroute (Health Check)
app.get('/', (req, res) => {
  res.status(200).send('The Only Tab Streaming Core Engine is Active!');
});

// Wereldwijde variabelen om de browserstaat bij te houden
let browser = null;
let page = null;
let currentUrlInStream = "";

// 3. Start de actieve Puppeteer Browser-instantie
async function initPuppeteer() {
  try {
    console.log("Launching headless cloud browser via Puppeteer...");
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--window-size=1280,720'
      ],
      defaultViewport: { width: 1280, height: 720 }
    });
    page = await browser.newPage();
    await page.setDefaultNavigationTimeout(30000);
    console.log("Cloud browser successfully initialized and drawing canvas!");
  } catch (err) {
    console.error("Fatal Error initializing Puppeteer:", err.message);
  }
}

// 4. De Database Sync & Live Streaming Lus (24 frames per seconde)
async function startStreamingCore() {
  const dbConfig = {
    user: 'postgres.fvqeeriisoediuwbftvh',
    host: 'aws-1-eu-west-1.pooler.supabase.com',
    database: 'postgres',
    password: process.env.DATABASE_PASSWORD, // 100% VEILIG & DYNAMISCH!
    port: 6543,
    ssl: { rejectUnauthorized: false }
  };

  // Start eerst de browser op de achtergrond
  await initPuppeteer();

  // Elke 3 seconden controleren we de database op een nieuwe URL
  setInterval(async () => {
    try {
      const pgClient = new Client(dbConfig);
      await pgClient.connect();
      
      const res = await pgClient.query(
        `SELECT current_url FROM slots WHERE is_frozen = FALSE AND expires_at > NOW() LIMIT 1`
      );
      await pgClient.end();

      let targetUrl = "https://theonlytab.io"; 
      if (res.rows && res.rows.length > 0) {
        targetUrl = res.rows.current_url;
      }

      if (targetUrl !== currentUrlInStream && page) {
        console.log(`Stream target shifted! Steering browser to: ${targetUrl}`);
        currentUrlInStream = targetUrl;
        await page.goto(targetUrl, { waitUntil: 'networkidle2' }).catch(() => {});
      }

    } catch (dbErr) {
      console.error("Database sync loop error:", dbErr.message);
    }
  }, 3000);

  // DE LIVE FRAME LUS: Schiet vloeibare JPEG-screenshots naar de frontend via WebSockets
  setInterval(async () => {
    if (!page || !browser) return;
    try {
      const screenshotBase64 = await page.screenshot({
        type: 'jpeg',
        quality: 40, 
        encoding: 'base64'
      });

      io.emit('v-frame', screenshotBase64);
    } catch (streamErr) {
      // Voorkom spam in de logs bij herladen
    }
  }, 41);
}

// 5. Start de applicatie op de juiste volgorde
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server fully bound and locked on port ${PORT}`);
  startStreamingCore();
});
