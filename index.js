const fs = require("fs");
const path = require("path");
const { Client, Collection, GatewayIntentBits, Events } = require("discord.js");
const { MongoClient } = require("mongodb");
const express = require("express");
const http = require("http");
const https = require("https");

// Initialize Discord client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

// Load commands dynamically
const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if (command.data && command.execute) {
      client.commands.set(command.data.name, command);
    } else {
      console.warn(`[WARNING] Missing "data" or "execute" in ${filePath}`);
    }
  }
}

// MongoDB Connection
let db;
(async () => {
  try {
    const mongoClient = new MongoClient(process.env.MONGODB_URI);
    await mongoClient.connect();
    db = mongoClient.db("discord-bot");
    console.log("✅ Connected to MongoDB");
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err);
  }
})();

// Express App for Health Check
const app = express();
const PORT = process.env.HEALTH_CHECK_PORT || 3000;

// Basic health check endpoint
app.get("/healthz", async (req, res) => {
  if (!db) {
    return res
      .status(500)
      .json({ status: "error", message: "Database not connected" });
  }
  return res.status(200).json({ status: "ok" });
});

// **SSE-based Health Check Streaming**
app.get("/healthz/stream", (req, res) => {
  const HEALTH_CHECK_URL = process.env.HEALTH_CHECK_URL;
  if (!HEALTH_CHECK_URL) {
    return res
      .status(500)
      .json({ status: "error", message: "HEALTH_CHECK_URL not set" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  console.log("🔄 Client connected to health check stream");

  const sendHealthCheck = () => {
    const protocol = HEALTH_CHECK_URL.startsWith("https") ? https : http;
    const req = protocol.get(HEALTH_CHECK_URL, (healthRes) => {
      if (healthRes.statusCode === 200) {
        res.write('data: { "status": "ok" }\n\n');
      } else {
        console.error(`⚠️ Health check failed: ${healthRes.statusCode}`);
        res.write(
          `data: { "status": "error", "code": ${healthRes.statusCode} }\n\n`
        );
      }
    });

    req.on("error", (err) => {
      console.error("❌ Health check request error:", err.message);
      res.write(`data: { "status": "error", "message": "${err.message}" }\n\n`);
    });

    req.end();
  };

  // Perform initial health check immediately
  sendHealthCheck();

  // Schedule periodic health checks every 10 minutes
  const interval = setInterval(sendHealthCheck, 10 * 60 * 1000);

  // Auto-close inactive connections after 15 minutes
  const clientTimeout = setTimeout(() => {
    console.log("⏳ Closing idle SSE connection");
    clearInterval(interval);
    res.end();
  }, 15 * 60 * 1000);

  // Handle client disconnect
  req.on("close", () => {
    console.log("🔌 Client disconnected from health check stream");
    clearTimeout(clientTimeout);
    clearInterval(interval);
    res.end();
  });
});

// Start Express server
app.listen(PORT, () => {
  console.log(`✅ Health check API running on port ${PORT}`);
});

// Discord bot event handlers
client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    console.error(`⚠️ Command not found: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction, db);
  } catch (error) {
    console.error(`❌ Error executing ${interaction.commandName}:`, error);
    await interaction.reply({
      content: "⚠️ An error occurred.",
      ephemeral: true,
    });
  }
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);

