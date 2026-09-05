#!/usr/bin/env node
/**
 * Turnkey Telegram Bot for Labubu Empire WebApp
 * Zero dependencies — uses native Node.js fetch
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env if present
try {
  const envContent = readFileSync(resolve(process.cwd(), ".env"), "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const [k, ...v] = trimmed.split("=");
    if (k && v.length) {
      process.env[k.trim()] = v.join("=").replace(/^["']|["']$/g, "").trim();
    }
  });
} catch {}

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

if (!TOKEN || TOKEN === "dev_bot_token") {
  console.log("\n⚠️ TELEGRAM_BOT_TOKEN не задан или равен 'dev_bot_token' в .env.");
  console.log("👉 Для запуска реального бота в Telegram укажите токен от @BotFather в .env:");
  console.log("   TELEGRAM_BOT_TOKEN=\"123456789:ABCdef...\"");
  console.log("   WEBAPP_URL=\"https://your-domain-or-tunnel.com\"\n");
}

const API_BASE = `https://api.telegram.org/bot${TOKEN}`;

async function tgCall(method, body = {}) {
  const res = await fetch(`${API_BASE}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API [${method}] Error: ${data.description}`);
  }
  return data.result;
}

async function initBot() {
  try {
    const me = await tgCall("getMe");
    console.log(`🤖 Бот успешно авторизован: @${me.username} (${me.first_name})`);

    // Setup Chat Menu Button (permanent WebApp launch button in bottom-left)
    await tgCall("setChatMenuButton", {
      menu_button: {
        type: "web_app",
        text: "🎮 Играть",
        web_app: { url: WEBAPP_URL },
      },
    });
    console.log(`🔗 Кнопка меню WebApp настроена на: ${WEBAPP_URL}`);

    // Set commands
    await tgCall("setMyCommands", {
      commands: [
        { command: "start", description: "Запустить Labubu Empire" },
        { command: "help", description: "Правила и помощь" },
      ],
    });

    console.log("🚀 Бот запущен в режиме Long-Polling и готов к приёму игроков!\n");
    pollUpdates(0);
  } catch (err) {
    console.error("❌ Ошибка инициализации бота:", err.message);
    console.log("Повторная попытка через 10 секунд...");
    setTimeout(initBot, 10000);
  }
}

async function pollUpdates(offset) {
  try {
    const updates = await tgCall("getUpdates", {
      offset,
      timeout: 25,
      allowed_updates: ["message"],
    });

    for (const update of updates) {
      offset = update.update_id + 1;
      if (update.message) {
        handleMessage(update.message);
      }
    }

    // Continue polling
    setImmediate(() => pollUpdates(offset));
  } catch (err) {
    console.error("⚠️ Сбой при получении обновлений:", err.message);
    setTimeout(() => pollUpdates(offset), 4000);
  }
}

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text || "";

  if (text.startsWith("/start")) {
    const parts = text.split(" ");
    let refParam = "";
    if (parts.length > 1 && parts[1].startsWith("ref_")) {
      refParam = parts[1].replace("ref_", "");
    }

    const appLaunchUrl = refParam
      ? `${WEBAPP_URL}?ref=${refParam}`
      : WEBAPP_URL;

    const welcomeText =
      `👋 **Добро пожаловать в Labubu Empire!**\n\n` +
      `🪙 **Валюта игры:** Российские рубли (₽)\n` +
      `🏭 **Фабрика:** Строй 7 этажей конвейеров и получай пассивный доход!\n` +
      `⚔️ **Казино & Дуэли:** Сражайся 1 на 1 в броске монетки или костей.\n` +
      `👥 **P2P переводы:** Отправляй рубли друзьям мгновенно.\n\n` +
      `${refParam ? "🎁 *Вам начислен приветственный бонус +1 000 ₽ по реферальной ссылке!*\n\n" : ""}` +
      `Нажми кнопку ниже, чтобы начать играть прямо в Telegram:`;

    await tgCall("sendMessage", {
      chat_id: chatId,
      text: welcomeText,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🎮 Запустить Labubu Empire",
              web_app: { url: appLaunchUrl },
            },
          ],
          [
            {
              text: "💬 Канал сообщества",
              url: "https://t.me/telegram",
            },
          ],
        ],
      },
    });
  } else if (text === "/help") {
    const helpText =
      `📖 **Как играть в Labubu Empire:**\n\n` +
      `1. **Тапай** по фигурке Labubu по центру экрана и зарабатывай рубли.\n` +
      `2. **Прокачивай клики и энергию** кнопкой снизу.\n` +
      `3. **Открывай цеха фабрики** (Этажи 1–7): ускоряй ленты и ставь до 4 автоматов на конвейер.\n` +
      `4. **Делай ставки в дуэлях** и забирай банк соперников.\n` +
      `5. **Приглашай друзей**: получай +5 000 ₽ за каждого и 10% от их пассивного дохода!`;

    await tgCall("sendMessage", {
      chat_id: chatId,
      text: helpText,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🎮 Начать играть",
              web_app: { url: WEBAPP_URL },
            },
          ],
        ],
      },
    });
  }
}

if (TOKEN && TOKEN !== "dev_bot_token") {
  initBot();
} else {
  console.log("ℹ️ Бот находится в режиме ожидания. После настройки TELEGRAM_BOT_TOKEN запустите: npm run bot");
}
