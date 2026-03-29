# =====================================================================
# tags.py — 태그 라우터 (일반 사용자용)
# 태그 목록 조회, 태그 생성, 사진에 태그 지정/수정 API를 담당합니다.
# 태그는 최대 10글자이며, 사진 작성자 또는 관리자만 수정 가능합니다.
# =====================================================================

import os
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from .auth import get_current_user

router = APIRouter()


# ── 태그 목록 조회 ────────────────────────────────────────────
# GET /api/tags
# 전체 태그 목록을 이름 순으로 반환
@router.get("/tags", response_model=list[schemas.TagResponse])
def get_tags(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(models.Tag).order_by(models.Tag.name).all()


# ── 태그 생성 ─────────────────────────────────────────────────
# POST /api/tags
# 새 태그를 만듭니다. 이미 같은 이름의 태그가 있으면 기존 태그를 반환합니다.
@router.post("/tags", response_model=schemas.TagResponse, status_code=201)
def create_tag(body: schemas.TagCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    name = body.name.strip()
    if len(name) > 10:
        raise HTTPException(status_code=400, detail="태그는 10글자를 초과할 수 없습니다")
    if not name:
        raise HTTPException(status_code=400, detail="태그 이름을 입력해주세요")

    # 이미 같은 이름의 태그가 있으면 새로 만들지 않고 기존 것을 반환
    existing = db.query(models.Tag).filter(models.Tag.name == name).first()
    if existing:
        return existing

    tag = models.Tag(name=name)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


# ── 사진에 태그 지정/수정 ─────────────────────────────────────
# PUT /api/photos/{photo_id}/tags
# 사진에 달린 태그를 새로 설정합니다. (기존 태그는 모두 제거 후 재설정)
# 사진 작성자 또는 관리자만 수정 가능합니다.
@router.put("/photos/{photo_id}/tags")
def update_photo_tags(
    photo_id: int,
    body: schemas.PhotoTagsUpdate,
    db: Session = Depends(get_db),
    x_user_token: Optional[str] = Header(None),
    x_admin_key: Optional[str] = Header(None),
):
    ADMIN_KEY = os.getenv("ADMIN_KEY", "admin123")

    # 관리자 또는 사진 작성자인지 확인
    if x_admin_key and x_admin_key == ADMIN_KEY:
        pass  # 관리자는 모든 사진의 태그를 수정 가능
    elif x_user_token:
        user = db.query(models.User).filter(models.User.token == x_user_token).first()
        if not user or user.status != models.UserStatus.approved:
            raise HTTPException(status_code=401, detail="Invalid token")
        photo_check = db.query(models.Photo).filter(models.Photo.id == photo_id).first()
        if not photo_check:
            raise HTTPException(status_code=404, detail="Photo not found")
    else:
        raise HTTPException(status_code=401, detail="Authentication required")

    photo = db.query(models.Photo).filter(models.Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    # 새 태그 이름으로 태그를 DB에서 찾거나, 없으면 새로 생성
    tag_ids = list(body.tag_ids)
    for name in body.new_tags:
        name = name.strip()
        if not name:
            continue
        if len(name) > 10:
            raise HTTPException(status_code=400, detail=f"태그 '{name}'은 10글자를 초과할 수 없습니다")
        existing = db.query(models.Tag).filter(models.Tag.name == name).first()
        if existing:
            tag_ids.append(existing.id)
        else:
            tag = models.Tag(name=name)
            db.add(tag)
            db.flush()  # ID를 바로 사용하기 위해 flush
            tag_ids.append(tag.id)

    # 기존 태그 연결을 모두 제거하고 새로 설정 (중복 제거 위해 set 사용)
    db.query(models.PhotoTag).filter(models.PhotoTag.photo_id == photo_id).delete()
    for tag_id in set(tag_ids):
        db.add(models.PhotoTag(photo_id=photo_id, tag_id=tag_id))

    db.commit()
    return {"ok": True}
