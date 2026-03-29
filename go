#!/bin/bash
set -e

EC2="ubuntu@43.201.129.254"
KEY="$HOME/.ssh/hajun-key.pem"

echo "=== 1. 프론트엔드 빌드 ==="
cd "$(dirname "$0")/frontend"
npm run build

echo "=== 2. 프론트엔드 업로드 ==="
rsync -avz --exclude '.DS_Store' -e "ssh -i $KEY" \
  dist/ $EC2:/opt/hajun/frontend/dist/ || true

echo "=== 3. 백엔드 업로드 ==="
rsync -avz --exclude '__pycache__' --exclude '*.pyc' --exclude '.env' --exclude '.DS_Store' \
  -e "ssh -i $KEY" \
  "$(dirname "$0")/backend/" $EC2:/opt/hajun/backend/ || true

echo "=== 4. 서버 재시작 ==="
ssh -i $KEY $EC2 "sudo systemctl restart hajun"

echo "=== 배포 완료! https://hajuni.org ==="
