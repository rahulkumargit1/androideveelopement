#!/bin/bash
# ============================================================
# VeriCash — EC2 Update Script
# Run this on the EC2 instance to pull latest changes and restart
#
# Usage: bash update_ec2.sh
# ============================================================

set -e
echo "=== VeriCash EC2 Update ==="

# ── 1. Pull latest code ─────────────────────────────────────────
echo "[1/4] Pulling latest code from GitHub..."
cd /home/ubuntu/FAKECURRENCYDETECTION
git fetch origin main
git reset --hard origin/main
echo "  Code updated"

# ── 2. Update Python dependencies ────────────────────────────────
echo "[2/4] Updating Python dependencies..."
cd /home/ubuntu/FAKECURRENCYDETECTION/backend
source .venv/bin/activate
pip install -r requirements.txt -q
deactivate
echo "  Dependencies updated"

# ── 3. Build web frontend (static export for nginx) ─────────────
echo "[3/4] Building web frontend..."
if command -v node &> /dev/null && [ -d "/home/ubuntu/FAKECURRENCYDETECTION/web" ]; then
    cd /home/ubuntu/FAKECURRENCYDETECTION/web
    npm install --legacy-peer-deps --no-audit --no-fund 2>/dev/null || true
    npm run build 2>/dev/null || echo "  Web build skipped (optional)"
    echo "  Web frontend built"
else
    echo "  Node.js not found or web dir missing, skipping web build"
fi

# ── 4. Restart services ─────────────────────────────────────────
echo "[4/4] Restarting VeriCash service..."
sudo systemctl restart vericash
sleep 3

# ── Verify ──────────────────────────────────────────────────────
STATUS=$(sudo systemctl is-active vericash)
if [ "$STATUS" = "active" ]; then
    echo ""
    echo "============================================================"
    echo "  ✅ VeriCash updated and running!"
    echo "============================================================"
    echo ""
    echo "  Service status: $STATUS"
    EC2_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "<your-ec2-ip>")
    echo "  API URL:      http://$EC2_IP:8001"
    echo "  Health check: http://$EC2_IP:8001/api/health"
    echo "  Swagger UI:   http://$EC2_IP:8001/docs"
    echo ""
    echo "  View logs: sudo journalctl -u vericash -f"
    echo "============================================================"
else
    echo ""
    echo "  ❌ Service not active! Check logs:"
    echo "     sudo journalctl -u vericash --no-pager -n 50"
    exit 1
fi
