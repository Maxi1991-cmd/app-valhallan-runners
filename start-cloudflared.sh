#!/bin/bash
# Kill existing cloudflared
pkill -f "cloudflared tunnel" 2>/dev/null
sleep 2
# Start cloudflared and log output
exec cloudflared tunnel --url http://localhost:3000 --no-tls-verify > /tmp/cf.log 2>&1
