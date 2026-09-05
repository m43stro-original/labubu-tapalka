#!/bin/bash
set -e

echo "=== Labubu Empire Production Setup ==="

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

echo "1. Applying database migrations..."
npx prisma db push

echo "2. Building Next.js production bundle..."
npm run build

echo "3. Installing systemd services..."
cp deploy/labubu-web.service /etc/systemd/system/labubu-web.service
cp deploy/labubu-bot.service /etc/systemd/system/labubu-bot.service

systemctl daemon-reload
systemctl enable labubu-web.service
systemctl enable labubu-bot.service
systemctl restart labubu-web.service

echo "✔ Web service started! Check status: systemctl status labubu-web"
echo "ℹ️ Don't forget to add your TELEGRAM_BOT_TOKEN to .env and run: systemctl restart labubu-bot"
echo "=== Done! ==="
