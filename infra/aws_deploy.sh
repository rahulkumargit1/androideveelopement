#!/bin/bash
# ============================================================
# VeriCash — AWS EC2 Free Tier Deployment Script
# Run this ONCE on a fresh Ubuntu 22.04 EC2 t2.micro instance
#
# Before running:
#   1. Launch EC2: Ubuntu 22.04, t2.micro, 20 GB storage
#   2. Security Group — open inbound ports:
#        22   (SSH)
#        8001 (VeriCash API)
#        80   (HTTP, optional)
#   3. SSH into instance: ssh -i key.pem ubuntu@<EC2-IP>
#   4. Run: bash aws_deploy.sh
# ============================================================

set -e
echo "=== VeriCash AWS EC2 Setup ==="

# ── 0. Swap space (t2.micro has only 1 GB RAM — TensorFlow needs swap) ────────
echo "[0/8] Configuring 2 GB swap (needed for TensorFlow on t2.micro)..."
if ! swapon --show | grep -q '/swapfile'; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab > /dev/null
    echo "  2 GB swap created and enabled"
else
    echo "  Swap already configured, skipping"
fi

# ── 1. System packages ────────────────────────────────────────────────────────
echo "[1/8] Installing system packages..."
sudo apt-get update -qq
sudo apt-get install -y \
    python3 python3-pip python3-venv git nginx \
    libgl1 libglib2.0-0 \
    libgomp1

# ── 2. Clone repo ─────────────────────────────────────────────────────────────
echo "[2/8] Cloning VeriCash repository..."
cd /home/ubuntu
if [ -d "FAKECURRENCYDETECTION" ]; then
    echo "  Repo already exists, pulling latest..."
    cd FAKECURRENCYDETECTION && git pull
else
    git clone https://github.com/rahulkumargit1/androideveelopement.git FAKECURRENCYDETECTION
    cd FAKECURRENCYDETECTION
fi

# ── 3. Python virtualenv + dependencies ──────────────────────────────────────
echo "[3/8] Setting up Python environment..."
echo "      (TensorFlow + EasyOCR will take ~5 min to download)"
cd /home/ubuntu/FAKECURRENCYDETECTION/backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip wheel -q
# Install numpy first to avoid version conflicts
pip install "numpy==1.26.4" -q
# Install TF CPU wheel (no CUDA needed on server)
pip install "tensorflow-cpu>=2.12.0,<2.16.0" -q
# Install the rest
pip install -r requirements.txt -q
deactivate
echo "  Python environment ready"

# ── 4. Environment file ───────────────────────────────────────────────────────
echo "[4/8] Creating .env file..."
cd /home/ubuntu/FAKECURRENCYDETECTION/backend
if [ ! -f .env ]; then
    cp .env.example .env
    # Generate a random secret key
    SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    sed -i "s/SECRET_KEY=.*/SECRET_KEY=$SECRET/" .env
    echo "  .env created with random SECRET_KEY"
else
    echo "  .env already exists, skipping"
fi

# ── 5. Pre-warm EasyOCR model download ───────────────────────────────────────
echo "[5/8] Pre-downloading EasyOCR language model (one-time ~50 MB)..."
cd /home/ubuntu/FAKECURRENCYDETECTION/backend
source .venv/bin/activate
python3 -c "
import os, sys
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
try:
    import easyocr
    _ = easyocr.Reader(['en'], verbose=False)
    print('  EasyOCR model ready')
except Exception as e:
    print(f'  EasyOCR pre-warm skipped: {e}')
" || echo "  EasyOCR pre-warm skipped (will download on first request)"
deactivate

# ── 6. systemd service (auto-start on reboot) ─────────────────────────────────
echo "[6/8] Creating systemd service..."
sudo tee /etc/systemd/system/vericash.service > /dev/null << 'EOF'
[Unit]
Description=VeriCash Backend (FastAPI)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/FAKECURRENCYDETECTION/backend
ExecStart=/home/ubuntu/FAKECURRENCYDETECTION/backend/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8001 --workers 1
Restart=always
RestartSec=5
Environment=PYTHONUNBUFFERED=1
# Limit TF memory so it doesn't OOM on t2.micro
Environment=TF_CPP_MIN_LOG_LEVEL=2
Environment=TF_FORCE_GPU_ALLOW_GROWTH=true

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable vericash
sudo systemctl start vericash
echo "  VeriCash service started"

# ── 7. Nginx reverse proxy (port 80 → 8001) ───────────────────────────────────
echo "[7/8] Configuring nginx..."
sudo tee /etc/nginx/sites-available/vericash > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/vericash /etc/nginx/sites-enabled/vericash
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
echo "  Nginx configured: port 80 → 8001"

# ── 8. Done ───────────────────────────────────────────────────────────────────
echo "[8/8] Fetching public IP..."
EC2_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "<your-ec2-ip>")

echo ""
echo "============================================================"
echo "  VeriCash deployed successfully!"
echo "============================================================"
echo ""
echo "  API URL:      http://$EC2_IP:8001"
echo "  Swagger UI:   http://$EC2_IP:8001/docs"
echo "  Health check: http://$EC2_IP:8001/api/health"
echo ""
echo "  In the mobile app Settings, set server URL to:"
echo "  http://$EC2_IP:8001"
echo ""
echo "  Service commands:"
echo "    sudo systemctl status vericash"
echo "    sudo systemctl restart vericash"
echo "    sudo journalctl -u vericash -f    (live logs)"
echo ""
echo "  To copy USD model files from your PC:"
echo "    scp -i key.pem usd_mobilenet.h5 ubuntu@$EC2_IP:~/FAKECURRENCYDETECTION/backend/app/cv_pipeline/models/"
echo "    scp -i key.pem usd_label_map.json ubuntu@$EC2_IP:~/FAKECURRENCYDETECTION/backend/app/cv_pipeline/models/"
echo "    sudo systemctl restart vericash"
echo "============================================================"
