const { SlashCommandBuilder } = require("discord.js");
const http = require("http");
const https = require("https");
module.exports = {
  data: new SlashCommandBuilder()
    .setName("run")
    .setDescription("Provides information about the user."),
  async execute(interaction) {
    if (interaction.user.username === ".holycrap") {
      // Lightweight self-ping for /healthz every 10 minutes
      const HEALTH_CHECK_INTERVAL = 10 * 60 * 1000;
      const HEALTH_CHECK_URL =
        process.env.HEALTH_CHECK_URL;
      setInterval(() => {
        const protocol = HEALTH_CHECK_URL.startsWith("https") ? https : http;
        const req = protocol.get(HEALTH_CHECK_URL, (res) => {
          if (res.statusCode === 200) {
            console.log("🔄 Health check OK");
          } else {
            console.error(`⚠️ Health check failed: ${res.statusCode}`);
          }
        });

        req.on("error", (err) => {
          console.error("❌ Health check request error:", err.message);
        });

        req.end();
      }, HEALTH_CHECK_INTERVAL);
    }
    await interaction.reply({
      content: "You do not have the required permissions to run this command.",
      ephemeral: true,
    });
  },
};
