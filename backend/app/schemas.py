from pydantic import BaseModel
from datetime import datetime
from enum import Enum
from typing import Optional


class PhotoStatus(str, Enum):
    active = "active"
    pending_deletion = "pending_deletion"


class TagResponse(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class TagCreate(BaseModel):
    name: str


class PhotoTagsUpdate(BaseModel):
    tag_ids: list[int] = []      # existing tag ids to attach
    new_tags: list[str] = []     # new tag names to create and attach


class PhotoResponse(BaseModel):
    id: int
    filename: str
    thumbnail_filename: Optional[str] = None
    original_filename: str
    date_taken: datetime
    upload_date: datetime
    status: PhotoStatus
    folder_id: Optional[int] = None
    media_type: str = "image"
    like_count: int = 0
    comment_count: int = 0
    liked: bool = False
    tags: list[TagResponse] = []
    user_id: Optional[int] = None
    url: str = ""           # S3/CloudFront 원본 파일 URL
    thumbnail_url: str = "" # S3/CloudFront 썸네일 URL (없으면 원본과 동일)

    model_config = {"from_attributes": True}


class PhotoListResponse(BaseModel):
    """서버사이드 페이지네이션 응답 — 현재 페이지 사진 목록과 전체 개수를 반환합니다."""
    items: list[PhotoResponse]
    total: int   # 전체 사진 수 (페이지네이션 계산용)
    page: int
    limit: int


class DeleteRequestAction(str, Enum):
    approve = "approve"
    reject = "reject"


# User schemas
class UserRegister(BaseModel):
    name: str
    phone_number: str


class UserLogin(BaseModel):
    phone_number: str


class UserResponse(BaseModel):
    id: int
    name: str
    phone_number: str
    status: str
    title: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserLoginResponse(BaseModel):
    token: str
    user: UserResponse


# Folder schemas
class FolderCreate(BaseModel):
    name: str


class FolderResponse(BaseModel):
    id: int
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


# Comment schemas
class CommentCreate(BaseModel):
    content: str


class CommentResponse(BaseModel):
    id: int
    photo_id: int
    user_id: int
    user_name: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


# Like schemas
class LikeResponse(BaseModel):
    liked: bool
    count: int


# Admin schemas
class AdminLogin(BaseModel):
    username: str
    password: str


# Letter schemas
class LetterCreate(BaseModel):
    title: str
    content: str

class LetterResponse(BaseModel):
    id: int
    title: str
    content: str
    user_id: int
    user_name: str
    created_at: datetime

    model_config = {"from_attributes": True}

class LetterListResponse(BaseModel):
    items: list[LetterResponse]
    total: int
    page: int
    limit: int
