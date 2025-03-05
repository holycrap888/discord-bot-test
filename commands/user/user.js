const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("user")
    .setDescription("Register the user in the database"),

  async execute(interaction, db) {
    try {
      await db.collection("user").updateOne(
        { userId: interaction.user.id },
        {
          $set: {
            userId: interaction.user.id,
            name: interaction.user.username,
            globalName:
              interaction.user.globalName || interaction.user.username,
            timestamp: new Date(),
          },
        },
        { upsert: true }
      );
      await interaction.reply(
        `✅ Registered user **${
          interaction.user.globalName || interaction.user.username
        }**`
      );
    } catch (error) {
      console.error("❌ Error registering user:", error);
      await interaction.reply({
        content: "⚠️ ไม่สามารถลงทะเบียนได้",
        ephemeral: true,
      });
    }
  },
};
