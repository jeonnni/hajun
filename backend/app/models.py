# =====================================================================
# models.py — 데이터베이스 테이블 정의
# 여기에 정의된 클래스 하나가 데이터베이스 테이블 하나에 해당합니다.
# SQLAlchemy ORM을 사용해서 파이썬 코드로 DB를 다룹니다.
# =====================================================================

import enum
from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from .database import Base


# ── 사진 상태 열거형 ──────────────────────────────────────────
class PhotoStatus(str, enum.Enum):
    active           = "active"            # 정상 표시 중
    pending_deletion = "pending_deletion"  # 삭제 요청됨 (관리자 승인 대기)


# ── 사용자 상태 열거형 ────────────────────────────────────────
class UserStatus(str, enum.Enum):
    pending  = "pending"   # 가입 신청 후 관리자 승인 대기 중
    approved = "approved"  # 관리자가 승인한 정상 회원
    rejected = "rejected"  # 관리자가 거절한 회원


# ── 사용자 테이블 ─────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String(100), nullable=False)                              # 이름
    phone_number = Column(String(20), unique=True, nullable=False)                  # 전화번호 (로그인 ID)
    status       = Column(Enum(UserStatus), default=UserStatus.pending, nullable=False)  # 승인 상태
    token        = Column(String(64), unique=True, nullable=True)                   # 로그인 인증 토큰
    title        = Column(String(20), nullable=True)                                # 호칭 (예: 삼촌, 이모)
    created_at   = Column(DateTime, server_default=func.now())                      # 가입 일시


# ── 폴더 테이블 ───────────────────────────────────────────────
class Folder(Base):
    __tablename__ = "folders"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String(255), nullable=False)      # 폴더 이름
    created_at = Column(DateTime, server_default=func.now())


# ── 사진 테이블 ───────────────────────────────────────────────
class Photo(Base):
    __tablename__ = "photos"

    id                 = Column(Integer, primary_key=True, index=True)
    filename           = Column(String(255), unique=True, nullable=False)  # S3에 저장된 UUID 파일명
    thumbnail_filename = Column(String(255), nullable=True)                # 썸네일 파일명 (이미지만 생성)
    original_filename  = Column(String(255), nullable=False)               # 업로드 시 원본 파일명
    date_taken         = Column(DateTime, nullable=False)                  # 촬영 일시 (EXIF 또는 업로드 시간)
    upload_date        = Column(DateTime, server_default=func.now(), nullable=False)  # 업로드 일시
    status             = Column(Enum(PhotoStatus), default=PhotoStatus.active, nullable=False)
    folder_id          = Column(Integer, ForeignKey("folders.id"), nullable=True)    # 소속 폴더 (미사용)
    media_type         = Column(String(10), default="image", nullable=False)         # "image" 또는 "video"
    user_id            = Column(Integer, ForeignKey("users.id"), nullable=True)      # 업로드한 사용자


# ── 댓글 테이블 ───────────────────────────────────────────────
class Comment(Base):
    __tablename__ = "comments"

    id         = Column(Integer, primary_key=True, index=True)
    photo_id   = Column(Integer, ForeignKey("photos.id"), nullable=False)  # 어떤 사진의 댓글인지
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)   # 댓글 작성자
    content    = Column(String(1000), nullable=False)                       # 댓글 내용
    created_at = Column(DateTime, server_default=func.now())


# ── 좋아요 테이블 ─────────────────────────────────────────────
class Like(Base):
    __tablename__ = "likes"

    id         = Column(Integer, primary_key=True, index=True)
    photo_id   = Column(Integer, ForeignKey("photos.id"), nullable=False)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    # 한 사용자가 같은 사진에 좋아요를 두 번 누를 수 없도록 제약
    __table_args__ = (UniqueConstraint("photo_id", "user_id"),)


# ── 태그 테이블 ───────────────────────────────────────────────
class Tag(Base):
    __tablename__ = "tags"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String(10), unique=True, nullable=False)  # 태그 이름 (최대 10글자)
    created_at = Column(DateTime, server_default=func.now())


# ── 사진-태그 연결 테이블 ─────────────────────────────────────
# 사진과 태그는 다대다(M:N) 관계 — 하나의 사진에 여러 태그, 하나의 태그가 여러 사진에 붙을 수 있음
class PhotoTag(Base):
    __tablename__ = "photo_tags"

    id       = Column(Integer, primary_key=True, index=True)
    photo_id = Column(Integer, ForeignKey("photos.id", ondelete="CASCADE"), nullable=False)
    tag_id   = Column(Integer, ForeignKey("tags.id",  ondelete="CASCADE"), nullable=False)

    # 같은 사진에 같은 태그를 중복으로 붙일 수 없도록 제약
    __table_args__ = (UniqueConstraint("photo_id", "tag_id"),)


# ── 편지 테이블 ───────────────────────────────────────────────
class Letter(Base):
    __tablename__ = "letters"

    id         = Column(Integer, primary_key=True, index=True)
    title      = Column(String(200), nullable=False)    # 편지 제목
    content    = Column(String(5000), nullable=False)   # 편지 내용
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)  # 작성자
    created_at = Column(DateTime, server_default=func.now())
