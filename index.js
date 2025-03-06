const fs = require("fs");
const path = require("path");
const { Client, Collection, GatewayIntentBits, Events } = require("discord.js");
const { MongoClient } = require("mongodb");
const express = require("express");

// Initialize Discord client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

// Load commands
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
    if ("data" in command && "execute" in command) {
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

// Create Express app for health check
const app = express();
const PORT = process.env.HEALTH_CHECK_PORT || 3000;

// Health check endpoint
app.get("/healthz", async (req, res) => {
  try {
    if (!db) {
      return res
        .status(500)
        .json({ status: "error", message: "Database not connected" });
    }
    return res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("❌ Health check error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error" });
  }
});

// Start the health check API
app.listen(PORT, () => {
  console.log(`✅ Health check API is running on port ${PORT}`);
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
