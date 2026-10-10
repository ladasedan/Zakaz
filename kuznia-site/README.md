# Kuznia Site / Golden Hands

Website for a handmade workshop with a portfolio gallery, multilingual UI (RU/UK/EN), theme switch, order questionnaire, admin panel, SQLite storage and optional Telegram bot notifications.

## Deploy on Railway

1. Upload the contents of this folder to a GitHub repository. Keep `.env.example` as a template; never commit `.env` or real credentials.
2. Create a Railway project from that repository.
3. In Railway Variables, add the values from `.env.example`:
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `SESSION_SECRET` (use a long random value)
   - `BASE_URL` (your deployed Railway URL)
   - `BOT_TOKEN` and `ADMIN_TELEGRAM_ID` if you want Telegram notifications
   - SMTP values only if email notifications are required
4. Railway runs `npm start` automatically. The app listens on `PORT` supplied by Railway.
5. Open `/admin.html` to sign in, add portfolio works, questions and contact details.

## Notes

- `data/db.sqlite` and the `uploads/` directory are created automatically at runtime.
- The SQLite database and uploads require persistent storage in production. Configure a Railway Volume mounted at the project directory or use a persistent path and adjust the paths in `server.js` and `bot.js`; ephemeral files may be lost on redeploy without a volume.
- Uploaded files are limited to 50 MB each.
- Telegram bot starts only when `BOT_TOKEN` is configured.
- Telegram can only send a reply to a user if that user has started the bot and the saved contact value is a valid Telegram chat ID. A public `@username` is not always a valid destination for bot messages.
- For safety, use a unique admin password and session secret. Do not store secrets in GitHub.
