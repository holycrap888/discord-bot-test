const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Get user stats"),
  
  async execute(interaction, db) {
    try {
      const userCount = await db.collection("user").countDocuments();
      await interaction.reply(`📊 มีผู้ใช้ทั้งหมด ${userCount} คน`);
    } catch (error) {
      console.error("❌ Error fetching stats:", error);
      await interaction.reply({ content: "⚠️ ไม่สามารถดึงข้อมูลสถิติได้", ephemeral: true });
    }
  },
};
