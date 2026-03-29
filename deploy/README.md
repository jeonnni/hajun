# AWS 배포 가이드

## 전체 순서

1. EC2 인스턴스 생성
2. Elastic IP 연결
3. 도메인 DNS 설정
4. EC2 서버 초기 세팅
5. 코드 배포
6. HTTPS 인증서 발급

---

## 1. EC2 인스턴스 생성

AWS 콘솔 → EC2 → 인스턴스 시작

| 항목 | 설정값 |
|------|--------|
| AMI | Ubuntu 22.04 LTS |
| 인스턴스 유형 | t3.micro (월 ~$8) |
| 키 페어 | 새로 생성 → hajun-key.pem 저장 |
| 보안 그룹 | SSH(22), HTTP(80), HTTPS(443) 인바운드 허용 |
| 스토리지 | 20GB gp3 |

키 파일 권한 설정:
```bash
chmod 400 ~/.ssh/hajun-key.pem
```

---

## 2. Elastic IP 연결 (필수 — 재시작해도 IP 안 바뀜)

1. EC2 → 탄력적 IP → 탄력적 IP 주소 할당
2. 할당된 IP 선택 → 작업 → 탄력적 IP 주소 연결
3. 방금 만든 인스턴스 선택 → 연결

---

## 3. 도메인 DNS 설정

도메인 구매처(가비아, Namecheap, Route 53 등)에서:

- **A 레코드** 추가: `@` → Elastic IP 주소
- **A 레코드** 추가: `www` → Elastic IP 주소

DNS 전파는 최대 48시간 걸리지만 보통 30분 내외입니다.

---

## 4. EC2 서버 초기 세팅 (처음 한 번만)

```bash
# EC2 접속
ssh -i ~/.ssh/hajun-key.pem ubuntu@YOUR_ELASTIC_IP

# setup.sh 업로드 후 실행
scp -i ~/.ssh/hajun-key.pem setup.sh ubuntu@YOUR_ELASTIC_IP:~/
bash setup.sh
```

서버에서 MySQL 설치 (RDS 대신 로컬 사용 시):
```bash
sudo apt install -y mysql-server
sudo mysql
CREATE DATABASE photogallery CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'hajun'@'localhost' IDENTIFIED BY 'yourpassword';
GRANT ALL PRIVILEGES ON photogallery.* TO 'hajun'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

## 5. 코드 배포

**deploy.sh 수정** (로컬에서):
```bash
# deploy/deploy.sh 열어서 아래 두 줄 수정
EC2_HOST="ubuntu@YOUR_ELASTIC_IP"
KEY_PATH="~/.ssh/hajun-key.pem"
```

**.env 파일을 EC2에 직접 생성** (보안상 rsync로 올리지 않음):
```bash
ssh -i ~/.ssh/hajun-key.pem ubuntu@YOUR_ELASTIC_IP
mkdir -p /opt/hajun/backend
nano /opt/hajun/backend/.env
```
`.env` 내용 붙여넣기:
```
DATABASE_URL=mysql+pymysql://hajun:yourpassword@localhost:3306/photogallery
ADMIN_KEY=admin123
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-northeast-2
S3_BUCKET_NAME=hajun-photos-0711
CLOUDFRONT_URL=
```

**배포 실행** (로컬에서):
```bash
bash deploy/deploy.sh
```

---

## 6. systemd 서비스 등록 (자동 재시작)

```bash
# EC2 서버에서
sudo cp /opt/hajun/backend/../deploy/hajun.service /etc/systemd/system/
# 또는 로컬에서 직접 업로드:
scp -i ~/.ssh/hajun-key.pem deploy/hajun.service ubuntu@YOUR_ELASTIC_IP:~/
ssh -i ~/.ssh/hajun-key.pem ubuntu@YOUR_ELASTIC_IP
sudo cp ~/hajun.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable hajun   # 부팅 시 자동 시작 등록
sudo systemctl start hajun    # 지금 시작
sudo systemctl status hajun   # 상태 확인
```

---

## 7. Nginx 설정

```bash
# nginx.conf의 YOUR_DOMAIN.com을 실제 도메인으로 수정 후:
scp -i ~/.ssh/hajun-key.pem deploy/nginx.conf ubuntu@YOUR_ELASTIC_IP:~/
ssh -i ~/.ssh/hajun-key.pem ubuntu@YOUR_ELASTIC_IP

sudo cp ~/nginx.conf /etc/nginx/sites-available/hajun
sudo ln -s /etc/nginx/sites-available/hajun /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

---

## 8. HTTPS 인증서 발급 (도메인 DNS 전파 후)

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

이후 자동으로 인증서 갱신됩니다 (90일마다).

---

## 유용한 명령어

```bash
# 서버 로그 실시간 보기
sudo journalctl -u hajun -f

# 서버 재시작
sudo systemctl restart hajun

# Nginx 재시작
sudo systemctl reload nginx

# 서버 상태 확인
sudo systemctl status hajun
```
