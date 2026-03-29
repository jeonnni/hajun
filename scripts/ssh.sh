#!/bin/bash
# EC2 서버에 SSH 접속
# 사용법: bash scripts/ssh.sh

EC2="ubuntu@43.201.129.254"
KEY="$HOME/.ssh/hajun-key.pem"

ssh -i "$KEY" "$EC2"
