#!/bin/bash
# =====================================================================
# setup.sh — EC2 Ubuntu 서버 초기 세팅 스크립트
# 처음 EC2에 접속했을 때 한 번만 실행하면 됩니다.
# 사용법: bash setup.sh
# =====================================================================

set -e  # 오류 발생 시 즉시 중단

echo "=== 1. 패키지 업데이트 ==="
sudo apt update && sudo apt upgrade -y

echo "=== 2. Python 3.11 + pip + venv 설치 ==="
sudo apt install -y python3.11 python3.11-venv python3-pip

echo "=== 3. Nginx 설치 ==="
sudo apt install -y nginx

echo "=== 4. MySQL 클라이언트 라이브러리 설치 (PyMySQL 의존성) ==="
sudo apt install -y libmysqlclient-dev pkg-config

echo "=== 5. certbot 설치 (HTTPS 인증서) ==="
sudo apt install -y certbot python3-certbot-nginx

echo "=== 6. 앱 디렉터리 생성 ==="
sudo mkdir -p /opt/hajun
sudo chown ubuntu:ubuntu /opt/hajun

echo "=== 완료! 이제 deploy.sh 를 실행하세요 ==="
