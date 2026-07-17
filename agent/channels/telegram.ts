import { telegramChannel } from "eve/channels/telegram";

export default telegramChannel({
  botUsername: process.env.TELEGRAM_BOT_NAME,
  credentials: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    webhookSecretToken: process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN,
  },
});
