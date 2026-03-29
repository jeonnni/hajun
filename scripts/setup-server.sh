#!/bin/bash
# EC2 서버 초기 세팅 (처음 한 번만 실행)
# 사용법: bash scripts/setup-server.sh

set -e

EC2="ubuntu@43.201.129.254"
KEY="$HOME/.ssh/hajun-key.pem"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== EC2 초기 세팅 시작 ==="

# setup.sh 업로드 후 실행
scp -i "$KEY" "$ROOT/deploy/setup.sh" $EC2:/tmp/setup.sh
ssh -i "$KEY" $EC2 "bash /tmp/setup.sh"

# nginx 설정 업로드
scp -i "$KEY" "$ROOT/deploy/nginx.conf" $EC2:/tmp/nginx.conf
ssh -i "$KEY" $EC2 "sudo cp /tmp/nginx.conf /etc/nginx/sites-available/hajun && \
  sudo ln -sf /etc/nginx/sites-available/hajun /etc/nginx/sites-enabled/hajun && \
  sudo nginx -t && sudo systemctl reload nginx"

# systemd 서비스 등록
scp -i "$KEY" "$ROOT/deploy/hajun.service" $EC2:/tmp/hajun.service
ssh -i "$KEY" $EC2 "sudo cp /tmp/hajun.service /etc/systemd/system/ && \
  sudo systemctl daemon-reload && sudo systemctl enable hajun"

echo "=== 초기 세팅 완료! 이제 deploy.sh 를 실행하세요 ==="
