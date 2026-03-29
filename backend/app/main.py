# =====================================================================
# main.py — FastAPI 백엔드 앱의 시작점
# 서버를 실행하면 이 파일이 가장 먼저 실행됩니다.
# CORS 설정, 파일 서빙, 각 기능별 라우터 등록을 담당합니다.
# =====================================================================

import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import Base, engine
from .routers import admin, auth, comments, folders, likes, photos, tags, letters

# .env 파일에서 환경변수(DATABASE_URL, UPLOAD_DIR 등)를 불러옴
load_dotenv()

# DB 테이블이 없으면 자동으로 생성 (models.py에 정의된 테이블 기준)
Base.metadata.create_all(bind=engine)

# FastAPI 앱 인스턴스 생성
app = FastAPI(title="Photo Gallery API")

# ── CORS 설정 ──────────────────────────────────────────────────
# 프론트엔드(localhost:5173)에서 백엔드(localhost:8000)로 요청을 보낼 수 있도록 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],   # GET, POST, PUT, DELETE 모두 허용
    allow_headers=["*"],   # 모든 헤더 허용 (x-user-token, x-admin-key 등)
)

# ── 업로드 파일 서빙 ───────────────────────────────────────────
# backend/uploads/ 폴더의 파일을 /uploads/파일명 URL로 접근 가능하게 만듦
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# ── 라우터 등록 ────────────────────────────────────────────────
# 각 기능별 API를 /api 접두어와 함께 등록
app.include_router(photos.router,   prefix="/api")  # 사진 업로드/조회/삭제 요청
app.include_router(admin.router,    prefix="/api")  # 관리자 기능
app.include_router(auth.router,     prefix="/api")  # 로그인/회원가입
app.include_router(folders.router,  prefix="/api")  # 폴더 관리
app.include_router(comments.router, prefix="/api")  # 댓글
app.include_router(likes.router,    prefix="/api")  # 좋아요
app.include_router(tags.router,     prefix="/api")  # 태그
app.include_router(letters.router,  prefix="/api")  # 편지
