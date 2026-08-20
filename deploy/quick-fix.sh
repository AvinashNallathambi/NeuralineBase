#!/bin/bash
set +e
cd /opt/neuraline

echo "=== Pulling latest ==="
git reset --hard HEAD
git clean -fd -- package-lock.json frontend/package-lock.json backend/package-lock.json
git pull origin main
echo "Commit: $(git rev-parse --short HEAD)"

echo "=== Root npm install ==="
rm -f package-lock.json frontend/package-lock.json backend/package-lock.json
rm -rf node_modules frontend/node_modules backend/node_modules
npm install --ignore-scripts 2>&1 | tail -10

echo "=== Check express ==="
ls backend/node_modules/express/package.json 2>&1 | head -1
ls node_modules/express/package.json 2>&1 | head -1

echo "=== Build backend ==="
cd backend
export NODE_OPTIONS='--max-old-space-size=1536'
npm run build 2>&1 | tail -20

echo "=== Check dist/main.js ==="
ls -la dist/main.js 2>&1

echo "=== Restarting PM2 ==="
cd /opt/neuraline
pm2 restart deploy/ecosystem.config.js --update-env 2>&1 || pm2 start deploy/ecosystem.config.js 2>&1
pm2 save 2>&1
sleep 15

echo "=== PM2 status ==="
pm2 status 2>&1

echo "=== Port 4000 ==="
sudo ss -ltnp | grep ':4000' || echo 'NOT LISTENING'

echo "=== Local health ==="
curl -sS -m 5 -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:4000/api/v1/health || echo 'curl failed'

echo "=== Recent error log (last 5) ==="
sudo tail -5 /var/log/neuraline/backend-error.log 2>/dev/null | sed 's/sk_test_[A-Za-z0-9]*/sk_test_REDACTED/g' || echo 'no error log'

echo "=== DONE ==="
