#!/bin/bash
# 프론트엔드만 빌드 후 배포 (백엔드 변경 없을 때)
# 사용법: bash scripts/deploy-frontend.sh

set -e

EC2="ubuntu@43.201.129.254"
KEY="$HOME/.ssh/hajun-key.pem"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== 1. 프론트엔드 빌드 ==="
cd "$ROOT/frontend"
npm run build

echo "=== 2. 프론트엔드 업로드 ==="
rsync -avz --exclude '.DS_Store' -e "ssh -i $KEY" \
  dist/ $EC2:/opt/hajun/frontend/dist/

echo "=== 3. 서버 재시작 ==="
ssh -i "$KEY" $EC2 "sudo systemctl restart hajun"

echo "=== 프론트엔드 배포 완료! ==="
