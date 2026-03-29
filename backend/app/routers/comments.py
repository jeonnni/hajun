# =====================================================================
# comments.py — 댓글 라우터
# 사진에 댓글을 작성, 조회, 삭제하는 API를 담당합니다.
# 댓글 작성자 이름에는 관리자가 지정한 호칭이 자동으로 붙습니다. (예: 홍길동(삼촌))
# =====================================================================

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from .auth import get_current_user

router = APIRouter()


# ── 댓글 목록 조회 ────────────────────────────────────────────
# GET /api/photos/{photo_id}/comments
# 특정 사진의 댓글을 오래된 순으로 반환합니다.
@router.get("/photos/{photo_id}/comments", response_model=list[schemas.CommentResponse])
def get_comments(
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    photo = db.query(models.Photo).filter(models.Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    comments = (
        db.query(models.Comment)
        .filter(models.Comment.photo_id == photo_id)
        .order_by(models.Comment.created_at.asc())  # 오래된 댓글이 위에 표시
        .all()
    )

    result = []
    for comment in comments:
        user = db.query(models.User).filter(models.User.id == comment.user_id).first()
        # 호칭이 있으면 "이름(호칭)" 형식으로, 없으면 이름만 표시
        user_name = f"{user.name}({user.title})" if user and user.title else (user.name if user else "Unknown")
        result.append({
            "id": comment.id,
            "photo_id": comment.photo_id,
            "user_id": comment.user_id,
            "user_name": user_name,
            "content": comment.content,
            "created_at": comment.created_at,
        })
    return result


# ── 댓글 작성 ─────────────────────────────────────────────────
# POST /api/photos/{photo_id}/comments
# 새 댓글을 작성합니다.
@router.post("/photos/{photo_id}/comments", response_model=schemas.CommentResponse, status_code=201)
def create_comment(
    photo_id: int,
    body: schemas.CommentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    photo = db.query(models.Photo).filter(models.Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    comment = models.Comment(
        photo_id=photo_id,
        user_id=current_user.id,
        content=body.content,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    # 호칭이 있으면 "이름(호칭)" 형식으로 반환
    user_name = f"{current_user.name}({current_user.title})" if current_user.title else current_user.name

    return {
        "id": comment.id,
        "photo_id": comment.photo_id,
        "user_id": comment.user_id,
        "user_name": user_name,
        "content": comment.content,
        "created_at": comment.created_at,
    }


# ── 댓글 삭제 ─────────────────────────────────────────────────
# DELETE /api/comments/{comment_id}
# 본인이 작성한 댓글만 삭제할 수 있습니다.
@router.delete("/comments/{comment_id}", status_code=204)
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    comment = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")

    db.delete(comment)
    db.commit()
