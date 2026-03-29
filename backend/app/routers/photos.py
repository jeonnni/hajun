# =====================================================================
# photos.py — 사진/영상 라우터
# 사진 업로드, 목록 조회(서버사이드 페이지네이션), 상세 조회, 삭제 요청 API를 담당합니다.
# 파일은 로컬 디스크 대신 AWS S3에 저장하고, CloudFront를 통해 서빙합니다.
# 이미지 업로드 시 400×400 썸네일을 자동 생성합니다.
# =====================================================================

import os
import uuid
from datetime import datetime
from typing import Optional

import boto3
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from PIL import Image
import io
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..s3 import delete_from_s3, generate_thumbnail, generate_video_thumbnail, get_file_url, upload_to_s3
from .auth import get_current_user

router = APIRouter()

# EXIF 태그 번호 36867 = DateTimeOriginal (촬영 일시)
EXIF_DATE_TAG = 36867

# 허용되는 파일 형식
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/avi", "video/webm", "video/mov"}
ALLOWED_TYPES = ALLOWED_IMAGE_TYPES | ALLOWED_VIDEO_TYPES

# 서버사이드 페이지네이션 기본값
DEFAULT_LIMIT = 12


# ── EXIF 날짜 추출 ────────────────────────────────────────────
# 사진 파일에서 촬영 일시를 읽어옵니다.
# EXIF 정보가 없거나 읽기 실패 시 None을 반환합니다.
def extract_exif_date(file_bytes: bytes) -> datetime | None:
    try:
        img = Image.open(io.BytesIO(file_bytes))
        exif = img._getexif()
        if exif and EXIF_DATE_TAG in exif:
            return datetime.strptime(exif[EXIF_DATE_TAG], "%Y:%m:%d %H:%M:%S")
    except Exception:
        pass
    return None


# ── 사진 데이터 가공 ──────────────────────────────────────────
# DB의 Photo 객체에 좋아요 수, 댓글 수, 태그 목록, 좋아요 여부, S3 URL을 추가해서 반환합니다.
def enrich_photo(photo: models.Photo, db: Session, current_user_id: int | None = None) -> dict:
    like_count    = db.query(models.Like).filter(models.Like.photo_id == photo.id).count()
    comment_count = db.query(models.Comment).filter(models.Comment.photo_id == photo.id).count()

    # 내가 좋아요를 눌렀는지 확인
    liked = False
    if current_user_id:
        liked = db.query(models.Like).filter(
            models.Like.photo_id == photo.id,
            models.Like.user_id == current_user_id,
        ).first() is not None

    # 이 사진에 붙은 태그 목록 조회
    photo_tags = db.query(models.PhotoTag).filter(models.PhotoTag.photo_id == photo.id).all()
    tags = []
    for pt in photo_tags:
        tag = db.query(models.Tag).filter(models.Tag.id == pt.tag_id).first()
        if tag:
            tags.append({"id": tag.id, "name": tag.name})

    # S3/CloudFront URL 생성
    url = get_file_url(photo.filename)
    thumbnail_url = get_file_url(photo.thumbnail_filename) if photo.thumbnail_filename else url

    return {
        "id": photo.id,
        "filename": photo.filename,
        "thumbnail_filename": photo.thumbnail_filename,
        "original_filename": photo.original_filename,
        "date_taken": photo.date_taken,
        "upload_date": photo.upload_date,
        "status": photo.status,
        "folder_id": photo.folder_id,
        "media_type": photo.media_type,
        "like_count": like_count,
        "comment_count": comment_count,
        "liked": liked,
        "tags": tags,
        "user_id": photo.user_id,
        "url": url,
        "thumbnail_url": thumbnail_url,
    }


# ── 사진 목록 조회 (서버사이드 페이지네이션) ──────────────────
# GET /api/photos?page=1&limit=12&tag_id=3
# 한 번에 12장씩만 반환합니다. 전체 개수(total)도 함께 반환해서 프론트에서 페이지 수를 계산합니다.
@router.get("/photos", response_model=schemas.PhotoListResponse)
def get_photos(
    page: int = 1,
    limit: int = DEFAULT_LIMIT,
    folder_id: Optional[int] = None,
    tag_id: Optional[int] = None,
    media_type: Optional[str] = None,   # "image" 또는 "video" — 해당 타입만 반환
    liked_only: bool = False,           # True면 내가 좋아요한 사진만 반환
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Photo)
    if folder_id is not None:
        query = query.filter(models.Photo.folder_id == folder_id)
    if tag_id is not None:
        # 태그로 필터링: PhotoTag 테이블을 조인해서 해당 태그가 달린 사진만 조회
        query = query.join(models.PhotoTag, models.Photo.id == models.PhotoTag.photo_id).filter(
            models.PhotoTag.tag_id == tag_id
        )
    if media_type in ("image", "video"):
        # 사진 또는 동영상만 필터링
        query = query.filter(models.Photo.media_type == media_type)
    if liked_only:
        # 내가 좋아요한 사진 ID만 추출 후 필터링
        liked_ids = db.query(models.Like.photo_id).filter(
            models.Like.user_id == current_user.id
        ).subquery()
        query = query.filter(models.Photo.id.in_(liked_ids))

    # 전체 개수 먼저 조회 (페이지 수 계산용)
    total = query.count()

    # 업로드 날짜 최신순 정렬 후 해당 페이지 범위만 가져옴
    photos = (
        query.order_by(models.Photo.upload_date.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return {
        "items": [enrich_photo(p, db, current_user.id) for p in photos],
        "total": total,
        "page": page,
        "limit": limit,
    }


# ── 사진/영상 업로드 ──────────────────────────────────────────
# POST /api/photos/upload
# 파일을 S3에 저장하고 DB에 기록합니다.
# 이미지의 경우 EXIF에서 촬영 날짜를 추출하고, 400×400 썸네일도 함께 생성해서 S3에 저장합니다.
@router.post("/photos/upload", response_model=schemas.PhotoResponse)
async def upload_photo(
    file: UploadFile = File(...),
    folder_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    content_type = file.content_type or ""
    # 허용된 파일 형식인지 확인
    if content_type not in ALLOWED_TYPES and not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image or video")

    is_video   = content_type in ALLOWED_VIDEO_TYPES
    media_type = "video" if is_video else "image"

    file_bytes = await file.read()

    if is_video:
        date_taken = datetime.now()  # 영상은 EXIF가 없으므로 현재 시간 사용
    else:
        # 사진: EXIF 촬영 날짜 추출, 없으면 현재 시간
        date_taken = extract_exif_date(file_bytes) or datetime.now()

    # UUID 파일명 생성 (파일명 충돌 방지)
    ext      = os.path.splitext(file.filename or "photo")[1] or (".mp4" if is_video else ".jpg")
    filename = f"{uuid.uuid4()}{ext}"

    # S3에 원본 파일 업로드
    upload_to_s3(file_bytes, filename, content_type)

    # 썸네일 생성 후 S3에 업로드 (이미지: Pillow, 동영상: ffmpeg)
    thumbnail_filename = None
    if is_video:
        thumb_bytes = generate_video_thumbnail(file_bytes)
    else:
        thumb_bytes = generate_thumbnail(file_bytes)
    if thumb_bytes:
        thumbnail_filename = f"{os.path.splitext(filename)[0]}_thumb.jpg"
        upload_to_s3(thumb_bytes, thumbnail_filename, "image/jpeg")

    # 폴더 ID가 전달된 경우 유효한 폴더인지 확인
    if folder_id is not None:
        folder = db.query(models.Folder).filter(models.Folder.id == folder_id).first()
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")

    # DB에 사진 정보 저장
    photo = models.Photo(
        filename=filename,
        thumbnail_filename=thumbnail_filename,
        original_filename=file.filename or filename,
        date_taken=date_taken,
        upload_date=datetime.now(),
        status=models.PhotoStatus.active,
        folder_id=folder_id,
        media_type=media_type,
        user_id=current_user.id,
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return enrich_photo(photo, db, current_user.id)


# ── 파일 다운로드 ─────────────────────────────────────────────
# GET /api/photos/{photo_id}/download
# S3에서 파일을 받아 브라우저에 강제 다운로드로 전달합니다.
@router.get("/photos/{photo_id}/download")
def download_photo(
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    photo = db.query(models.Photo).filter(models.Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    s3 = boto3.client(
        "s3",
        region_name=os.getenv("AWS_REGION", "ap-northeast-2"),
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    )
    bucket = os.getenv("S3_BUCKET_NAME", "")
    obj = s3.get_object(Bucket=bucket, Key=photo.filename)
    content_type = obj["ContentType"]

    # 파일명에 한글/특수문자 있으면 URL 인코딩
    from urllib.parse import quote
    encoded_name = quote(photo.original_filename, safe="")

    return StreamingResponse(
        obj["Body"],
        media_type=content_type,
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_name}",
            "Content-Length": str(obj["ContentLength"]),
        },
    )


# ── 사진 상세 조회 ────────────────────────────────────────────
# GET /api/photos/{photo_id}/detail
# 특정 사진의 상세 정보를 반환합니다. (상세 페이지에서 사용)
@router.get("/photos/{photo_id}/detail", response_model=schemas.PhotoResponse)
def get_photo_detail(
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    photo = db.query(models.Photo).filter(models.Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    return enrich_photo(photo, db, current_user.id)


# ── 삭제 요청 ─────────────────────────────────────────────────
# POST /api/photos/{photo_id}/request-deletion
# 사진 작성자가 삭제를 요청합니다.
# 즉시 삭제되지 않고 pending_deletion 상태로 변경됩니다.
# 관리자가 승인하면 실제로 S3에서 삭제됩니다.
@router.post("/photos/{photo_id}/cancel-deletion", response_model=schemas.PhotoResponse)
def cancel_deletion(
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    photo = db.query(models.Photo).filter(models.Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    if photo.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="본인 사진만 삭제 취소할 수 있습니다")
    if photo.status != models.PhotoStatus.pending_deletion:
        raise HTTPException(status_code=400, detail="Photo is not pending deletion")

    photo.status = models.PhotoStatus.active
    db.commit()
    db.refresh(photo)
    return enrich_photo(photo, db, current_user.id)


@router.post("/photos/{photo_id}/request-deletion", response_model=schemas.PhotoResponse)
def request_deletion(
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    photo = db.query(models.Photo).filter(models.Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    # 본인이 올린 사진만 삭제 요청 가능
    if photo.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="본인 사진만 삭제 요청할 수 있습니다")
    if photo.status != models.PhotoStatus.active:
        raise HTTPException(status_code=400, detail="Photo is not in active state")

    photo.status = models.PhotoStatus.pending_deletion
    db.commit()
    db.refresh(photo)
    return enrich_photo(photo, db, current_user.id)
