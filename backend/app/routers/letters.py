# =====================================================================
# letters.py — 편지 라우터
# =====================================================================

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from .auth import get_current_user

router = APIRouter()


# GET /api/letters
@router.get("/letters", response_model=schemas.LetterListResponse)
def get_letters(
    page: int = 1,
    limit: int = 16,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Letter).order_by(models.Letter.id.desc())
    total = query.count()
    items = query.offset((page - 1) * limit).limit(limit).all()

    result = []
    for letter in items:
        user = db.query(models.User).filter(models.User.id == letter.user_id).first()
        user_name = user.title if (user and user.title) else (user.name if user else "알 수 없음")
        result.append(schemas.LetterResponse(
            id=letter.id,
            title=letter.title,
            content=letter.content,
            user_id=letter.user_id,
            user_name=user_name,
            created_at=letter.created_at,
        ))

    return {"items": result, "total": total, "page": page, "limit": limit}


# POST /api/letters
@router.post("/letters", response_model=schemas.LetterResponse, status_code=201)
def create_letter(
    body: schemas.LetterCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="제목을 입력해주세요")
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="내용을 입력해주세요")

    letter = models.Letter(
        title=body.title.strip(),
        content=body.content.strip(),
        user_id=current_user.id,
    )
    db.add(letter)
    db.commit()
    db.refresh(letter)

    user_name = current_user.title if current_user.title else current_user.name
    return schemas.LetterResponse(
        id=letter.id,
        title=letter.title,
        content=letter.content,
        user_id=letter.user_id,
        user_name=user_name,
        created_at=letter.created_at,
    )


# GET /api/letters/{id}
@router.get("/letters/{letter_id}", response_model=schemas.LetterResponse)
def get_letter(
    letter_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    letter = db.query(models.Letter).filter(models.Letter.id == letter_id).first()
    if not letter:
        raise HTTPException(status_code=404, detail="편지를 찾을 수 없습니다")

    user = db.query(models.User).filter(models.User.id == letter.user_id).first()
    user_name = user.title if (user and user.title) else (user.name if user else "알 수 없음")
    return schemas.LetterResponse(
        id=letter.id,
        title=letter.title,
        content=letter.content,
        user_id=letter.user_id,
        user_name=user_name,
        created_at=letter.created_at,
    )


# PUT /api/letters/{id}
@router.put("/letters/{letter_id}", response_model=schemas.LetterResponse)
def update_letter(
    letter_id: int,
    body: schemas.LetterCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    letter = db.query(models.Letter).filter(models.Letter.id == letter_id).first()
    if not letter:
        raise HTTPException(status_code=404, detail="편지를 찾을 수 없습니다")
    if letter.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="본인 편지만 수정할 수 있습니다")
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="제목을 입력해주세요")
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="내용을 입력해주세요")

    letter.title = body.title.strip()
    letter.content = body.content.strip()
    db.commit()
    db.refresh(letter)

    user_name = current_user.title if current_user.title else current_user.name
    return schemas.LetterResponse(
        id=letter.id, title=letter.title, content=letter.content,
        user_id=letter.user_id, user_name=user_name, created_at=letter.created_at,
    )


# DELETE /api/letters/{id}
@router.delete("/letters/{letter_id}")
def delete_letter(
    letter_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    letter = db.query(models.Letter).filter(models.Letter.id == letter_id).first()
    if not letter:
        raise HTTPException(status_code=404, detail="편지를 찾을 수 없습니다")
    if letter.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="본인 편지만 삭제할 수 있습니다")
    db.delete(letter)
    db.commit()
    return {"ok": True}
