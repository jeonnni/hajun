# =====================================================================
# likes.py — 좋아요 라우터
# 사진에 좋아요를 누르거나 취소하는 토글 API와
# 현재 좋아요 수/내가 눌렀는지 조회하는 API를 담당합니다.
# =====================================================================

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from .auth import get_current_user

router = APIRouter()


# ── 좋아요 토글 ───────────────────────────────────────────────
# POST /api/photos/{photo_id}/like
# 이미 좋아요를 눌렀으면 취소, 안 눌렀으면 좋아요 추가
@router.post("/photos/{photo_id}/like", response_model=schemas.LikeResponse)
def toggle_like(
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    photo = db.query(models.Photo).filter(models.Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    # 이미 좋아요를 눌렀는지 확인
    existing = (
        db.query(models.Like)
        .filter(models.Like.photo_id == photo_id, models.Like.user_id == current_user.id)
        .first()
    )

    if existing:
        # 이미 좋아요 → 취소
        db.delete(existing)
        db.commit()
        liked = False
    else:
        # 좋아요 추가
        like = models.Like(photo_id=photo_id, user_id=current_user.id)
        db.add(like)
        db.commit()
        liked = True

    # 최신 좋아요 수 계산 후 반환
    count = db.query(models.Like).filter(models.Like.photo_id == photo_id).count()
    return {"liked": liked, "count": count}


# ── 좋아요 정보 조회 ──────────────────────────────────────────
# GET /api/photos/{photo_id}/likes
# 특정 사진의 좋아요 수와 내가 눌렀는지 여부를 반환
@router.get("/photos/{photo_id}/likes", response_model=schemas.LikeResponse)
def get_likes(
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    photo = db.query(models.Photo).filter(models.Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    count = db.query(models.Like).filter(models.Like.photo_id == photo_id).count()
    # 내가 좋아요를 눌렀는지 확인
    liked_by_me = (
        db.query(models.Like)
        .filter(models.Like.photo_id == photo_id, models.Like.user_id == current_user.id)
        .first()
    ) is not None

    return {"liked": liked_by_me, "count": count}
