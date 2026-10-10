require('dotenv').config();

const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'db.sqlite'));

if (!process.env.BOT_TOKEN) {
  console.log('BOT_TOKEN is not configured; Telegram bot will not start.');
} else {
  const bot = new Telegraf(process.env.BOT_TOKEN);
  global.bot = bot;
  const drafts = new Map();

  bot.start(ctx => ctx.reply(
    'Привет! 👋 Здесь вы можете заказать изделие: мебель, верстаки, декор и многое другое.',
    Markup.keyboard([['🛠 Сделать заказ'], ['📞 Контакты']]).resize()
  ));

  bot.hears('📞 Контакты', ctx => {
    const baseUrl = process.env.BASE_URL || '';
    ctx.reply(`Свяжитесь с мастерской через сайт${baseUrl ? `: ${baseUrl}/contact.html` : '.'}`);
  });

  bot.hears('🛠 Сделать заказ', ctx => {
    drafts.set(ctx.from.id, { step: 'description' });
    ctx.reply('Опишите, что вы хотите заказать:');
  });

  bot.on('text', async ctx => {
    const text = ctx.message.text;
    if (text.startsWith('/')) return;
    const draft = drafts.get(ctx.from.id);
    if (!draft) {
      return ctx.reply('Нажмите «🛠 Сделать заказ», чтобы начать оформление.');
    }

    if (draft.step === 'description') {
      draft.description = text.slice(0, 10000);
      draft.step = 'contact';
      return ctx.reply('Как с вами связаться? Отправьте @username, email или номер телефона.');
    }

    if (draft.step === 'contact') {
      const contact = text.trim().slice(0, 500);
      const type = contact.includes('@') && !contact.includes(' ') && !contact.includes('@gmail.com') && !contact.includes('@outlook.com')
        ? 'telegram'
        : (contact.includes('@') ? 'email' : 'phone');

      const result = db.prepare(`
        INSERT INTO orders (answers,contact_type,contact_value,files)
        VALUES (?,?,?,'[]')
      `).run(draft.description, type, contact);

      drafts.delete(ctx.from.id);
      await ctx.reply(`✅ Заказ #${result.lastInsertRowid} принят! Мы свяжемся с вами и уточним детали.`);

      if (process.env.ADMIN_TELEGRAM_ID) {
        const username = ctx.from.username ? `@${ctx.from.username}` : 'не указан';
        const message = `🔔 Заказ через Telegram #${result.lastInsertRowid}\n\nОт пользователя: ${username} (ID ${ctx.from.id})\n\nОписание:\n${draft.description}\n\nКонтакт: ${contact}`;
        bot.telegram.sendMessage(process.env.ADMIN_TELEGRAM_ID, message).catch(err => console.error('Admin notification failed:', err.message));
      }
    }
  });

  bot.catch(err => console.error('Telegram bot error:', err));
  bot.launch().then(() => console.log('Telegram bot started')).catch(err => console.error('Telegram bot failed to start:', err.message));

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
