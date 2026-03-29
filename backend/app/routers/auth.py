# =====================================================================
# auth.py — 사용자 인증 라우터
# 회원가입, 로그인, 내 정보 조회 API를 담당합니다.
# 인증은 전화번호 기반이며, 로그인 성공 시 UUID 토큰을 발급합니다.
# =====================================================================

import uuid

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter()


# ── 인증 의존성 함수 ──────────────────────────────────────────
# 요청 헤더의 x-user-token을 확인해서 유효한 승인된 사용자인지 검증합니다.
# 다른 라우터에서 Depends(get_current_user)로 사용합니다.
def get_current_user(x_user_token: str = Header(...), db: Session = Depends(get_db)) -> models.User:
    user = db.query(models.User).filter(models.User.token == x_user_token).first()
    if not user or user.status != models.UserStatus.approved:
        raise HTTPException(status_code=401, detail="Invalid or unauthorized token")
    return user


# ── 회원가입 ──────────────────────────────────────────────────
# POST /api/auth/register
# 이름과 전화번호를 받아 pending(승인 대기) 상태로 가입 신청
@router.post("/auth/register", response_model=schemas.UserResponse, status_code=201)
def register(body: schemas.UserRegister, db: Session = Depends(get_db)):
    # 이미 같은 전화번호로 가입한 사용자가 있는지 확인
    existing = db.query(models.User).filter(models.User.phone_number == body.phone_number).first()
    if existing:
        raise HTTPException(status_code=409, detail="Phone number already registered")

    user = models.User(
        name=body.name,
        phone_number=body.phone_number,
        status=models.UserStatus.pending,  # 관리자 승인 전까지 pending 상태
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ── 로그인 ────────────────────────────────────────────────────
# POST /api/auth/login
# 전화번호로 로그인 — 성공 시 새 UUID 토큰을 발급해서 반환
@router.post("/auth/login", response_model=schemas.UserLoginResponse)
def login(body: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.phone_number == body.phone_number).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 승인되지 않은 사용자는 로그인 불가
    if user.status == models.UserStatus.pending:
        raise HTTPException(status_code=403, detail="승인 대기 중입니다")
    if user.status == models.UserStatus.rejected:
        raise HTTPException(status_code=403, detail="접근이 거부되었습니다")

    # 새 토큰 생성 후 DB에 저장 (로그인할 때마다 토큰이 새로 발급됨)
    token = uuid.uuid4().hex
    user.token = token
    db.commit()
    db.refresh(user)
    return {"token": token, "user": user}


# ── 내 정보 조회 ──────────────────────────────────────────────
# GET /api/auth/me
# 현재 로그인된 사용자의 정보를 반환 (앱 재시작 시 로그인 상태 복원에 사용)
@router.get("/auth/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user
