# =====================================================================
# admin.py — 관리자 전용 라우터
# 관리자(admin/0711)만 접근할 수 있는 API를 담당합니다.
# 모든 요청은 x-admin-key 헤더를 통해 인증합니다.
#
# 담당 기능:
#   - 관리자 로그인
#   - 신규 회원 승인/거절
#   - 사진 삭제 요청 승인(파일+DB 삭제)/거절(복원)
#   - 태그 CRUD (추가/수정/삭제)
#   - 회원 호칭 설정 (예: 홍길동 → 홍길동(삼촌))
# =====================================================================

import os

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from .photos import enrich_photo
from ..s3 import delete_from_s3

router = APIRouter()

# 환경변수에서 관리자 설정 로드 (기본값: admin / 0711)
ADMIN_KEY      = os.getenv("ADMIN_KEY", "admin123")
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "0711"


# ── 관리자 인증 의존성 함수 ───────────────────────────────────
# 요청 헤더의 x-admin-key 값이 올바른지 확인합니다.
# 다른 엔드포인트에서 Depends(verify_admin)으로 사용합니다.
def verify_admin(x_admin_key: str = Header(...)):
    if x_admin_key != ADMIN_KEY:
        raise HTTPException(status_code=401, detail="Invalid admin key")


# ── 관리자 로그인 ─────────────────────────────────────────────
# POST /api/admin/login
# 아이디/비밀번호를 확인하고 성공 시 admin_token(= ADMIN_KEY)을 반환합니다.
# 프론트엔드는 이 토큰을 이후 모든 관리자 API 요청의 x-admin-key 헤더에 사용합니다.
@router.post("/admin/login")
def admin_login(body: schemas.AdminLogin):
    if body.username != ADMIN_USERNAME or body.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"admin_token": ADMIN_KEY}


# ── 삭제 요청 대기 목록 조회 ──────────────────────────────────
# GET /api/admin/pending
# 사용자가 삭제 요청한 사진 목록을 반환합니다.
@router.get("/admin/pending", response_model=list[schemas.PhotoResponse])
def get_pending(db: Session = Depends(get_db), _: str = Depends(verify_admin)):
    photos = (
        db.query(models.Photo)
        .filter(models.Photo.status == models.PhotoStatus.pending_deletion)
        .all()
    )
    return [enrich_photo(p, db) for p in photos]


# ── 삭제 요청 처리 ────────────────────────────────────────────
# POST /api/admin/photos/{photo_id}/action?action=approve|reject
# approve: 파일을 디스크에서 삭제하고 DB 레코드도 제거
# reject:  상태를 다시 active로 되돌림 (복원)
@router.post("/admin/photos/{photo_id}/action")
def handle_action(
    photo_id: int,
    action: schemas.DeleteRequestAction,
    db: Session = Depends(get_db),
    _: str = Depends(verify_admin),
):
    photo = db.query(models.Photo).filter(models.Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    if photo.status != models.PhotoStatus.pending_deletion:
        raise HTTPException(status_code=400, detail="Photo is not pending deletion")

    if action == schemas.DeleteRequestAction.approve:
        # 승인: S3에서 원본 파일과 썸네일을 삭제 후 DB에서도 제거
        delete_from_s3(photo.filename)
        if photo.thumbnail_filename:
            delete_from_s3(photo.thumbnail_filename)
        db.delete(photo)
    else:
        # 거절: 사진을 다시 정상 상태로 복원
        photo.status = models.PhotoStatus.active

    db.commit()
    return {"ok": True}


# ── 승인 대기 회원 목록 조회 ──────────────────────────────────
# GET /api/admin/users/pending
# 가입 신청 후 아직 승인되지 않은 사용자 목록을 반환합니다.
@router.get("/admin/users/pending", response_model=list[schemas.UserResponse])
def get_pending_users(db: Session = Depends(get_db), _: str = Depends(verify_admin)):
    return (
        db.query(models.User)
        .filter(models.User.status == models.UserStatus.pending)
        .order_by(models.User.created_at.asc())  # 오래된 신청 순으로 표시
        .all()
    )


# ── 태그 목록 조회 (관리자용) ─────────────────────────────────
# GET /api/admin/tags
@router.get("/admin/tags", response_model=list[schemas.TagResponse])
def get_all_tags(db: Session = Depends(get_db), _: str = Depends(verify_admin)):
    return db.query(models.Tag).order_by(models.Tag.name).all()


# ── 태그 생성 (관리자용) ──────────────────────────────────────
# POST /api/admin/tags
@router.post("/admin/tags", response_model=schemas.TagResponse)
def create_tag_admin(body: schemas.TagCreate, db: Session = Depends(get_db), _: str = Depends(verify_admin)):
    name = body.name.strip()
    if len(name) > 10:
        raise HTTPException(status_code=400, detail="태그는 10글자를 초과할 수 없습니다")
    existing = db.query(models.Tag).filter(models.Tag.name == name).first()
    if existing:
        raise HTTPException(status_code=409, detail="이미 존재하는 태그입니다")
    tag = models.Tag(name=name)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


# ── 태그 삭제 (관리자용) ──────────────────────────────────────
# DELETE /api/admin/tags/{tag_id}
# 태그를 삭제하면 해당 태그가 붙은 모든 사진에서도 자동으로 제거됩니다. (CASCADE)
@router.delete("/admin/tags/{tag_id}")
def delete_tag(tag_id: int, db: Session = Depends(get_db), _: str = Depends(verify_admin)):
    tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    db.delete(tag)
    db.commit()
    return {"ok": True}


# ── 태그 수정 (관리자용) ──────────────────────────────────────
# PUT /api/admin/tags/{tag_id}
@router.put("/admin/tags/{tag_id}")
def update_tag(tag_id: int, body: schemas.TagCreate, db: Session = Depends(get_db), _: str = Depends(verify_admin)):
    tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    name = body.name.strip()
    if len(name) > 10:
        raise HTTPException(status_code=400, detail="태그는 10글자를 초과할 수 없습니다")
    tag.name = name
    db.commit()
    db.refresh(tag)
    return tag


# ── 승인된 전체 회원 목록 조회 ────────────────────────────────
# GET /api/admin/users
# 호칭 관리 탭에서 사용합니다.
@router.get("/admin/users", response_model=list[schemas.UserResponse])
def get_all_users(db: Session = Depends(get_db), _: str = Depends(verify_admin)):
    return (
        db.query(models.User)
        .filter(models.User.status == models.UserStatus.approved)
        .order_by(models.User.name.asc())
        .all()
    )


# ── 회원 호칭 설정 ────────────────────────────────────────────
# PUT /api/admin/users/{user_id}/title
# 회원에게 호칭을 지정합니다. 빈 문자열을 보내면 호칭이 제거됩니다.
# 지정 후 댓글에서 "홍길동(삼촌)" 형식으로 표시됩니다.
@router.put("/admin/users/{user_id}/title")
def set_user_title(
    user_id: int,
    body: dict,
    db: Session = Depends(get_db),
    _: str = Depends(verify_admin),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    title = (body.get("title") or "").strip() or None  # 빈 문자열이면 None으로 처리 (호칭 제거)
    if title and len(title) > 20:
        raise HTTPException(status_code=400, detail="호칭은 20글자를 초과할 수 없습니다")
    user.title = title
    db.commit()
    db.refresh(user)
    return user


# ── 신규 회원 승인/거절 ───────────────────────────────────────
# POST /api/admin/users/{user_id}/action?action=approve|reject
# approve: 회원 상태를 approved로 변경 → 로그인 가능
# reject:  회원 상태를 rejected로 변경 → 로그인 불가
@router.post("/admin/users/{user_id}/action")
def handle_user_action(
    user_id: int,
    action: str,
    db: Session = Depends(get_db),
    _: str = Depends(verify_admin),
):
    if action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Action must be 'approve' or 'reject'")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if action == "approve":
        user.status = models.UserStatus.approved  # 승인 → 로그인 가능
    else:
        user.status = models.UserStatus.rejected  # 거절 → 로그인 불가

    db.commit()
    return {"ok": True}
