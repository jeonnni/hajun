"""
썸네일이 없는 동영상의 썸네일을 일괄 생성합니다.
사용법: python generate_missing_thumbs.py
"""

import os
import sys
import subprocess
import tempfile

sys.path.insert(0, os.path.dirname(__file__))

import boto3
from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app import models
from app.s3 import upload_to_s3

DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://root:password@localhost:3306/photogallery")
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=60)
SessionLocal = sessionmaker(bind=engine)

AWS_REGION     = os.getenv("AWS_REGION", "ap-northeast-2")
S3_BUCKET      = os.getenv("S3_BUCKET_NAME", "")
AWS_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
THUMB_SIZE     = 400


def s3_client():
    return boto3.client(
        "s3",
        region_name=AWS_REGION,
        aws_access_key_id=AWS_ACCESS_KEY,
        aws_secret_access_key=AWS_SECRET_KEY,
    )


def download_to_file(filename: str, dest_path: str) -> bool:
    """S3에서 직접 파일로 다운로드 (메모리에 올리지 않음)"""
    try:
        s3_client().download_file(S3_BUCKET, filename, dest_path)
        return True
    except Exception as e:
        print(f"S3 다운로드 실패: {e}")
        return False


def generate_thumbnail_from_file(video_path: str, out_path: str) -> bool:
    """ffmpeg로 동영상 파일에서 썸네일 생성. 1초 실패 시 0초로 재시도"""
    for ss in ("00:00:01", "00:00:00"):
        try:
            result = subprocess.run(
                [
                    "ffmpeg", "-y",
                    "-i", video_path,
                    "-ss", ss,
                    "-vframes", "1",
                    "-vf", f"scale={THUMB_SIZE}:{THUMB_SIZE}:force_original_aspect_ratio=decrease",
                    out_path,
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                timeout=30,
            )
            if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
                return True
            print(f"\n  ffmpeg({ss}) 오류: {result.stderr.decode(errors='replace').strip()[-200:]}")
        except Exception as e:
            print(f"\n  예외({ss}): {e}")
    return False


def get_pending_ids():
    db = SessionLocal()
    try:
        return (
            db.query(models.Photo.id, models.Photo.filename, models.Photo.original_filename)
            .filter(
                models.Photo.media_type == "video",
                models.Photo.thumbnail_filename == None,
            )
            .all()
        )
    finally:
        db.close()


def update_thumbnail(video_id: int, thumb_filename: str):
    db = SessionLocal()
    try:
        video = db.query(models.Photo).filter(models.Photo.id == video_id).first()
        if video:
            video.thumbnail_filename = thumb_filename
            db.commit()
    finally:
        db.close()


def main():
    rows = get_pending_ids()
    total = len(rows)
    print(f"썸네일 없는 동영상: {total}개")
    if not total:
        print("모두 썸네일이 있습니다.")
        return

    ok, fail = 0, 0
    for i, (video_id, filename, original_filename) in enumerate(rows, 1):
        print(f"[{i}/{total}] {original_filename} (id={video_id}) ...", end=" ", flush=True)

        tmp_video = tempfile.mktemp(suffix=os.path.splitext(filename)[1] or ".mp4")
        tmp_thumb = tempfile.mktemp(suffix=".jpg")
        try:
            if not download_to_file(filename, tmp_video):
                print("실패 (다운로드 오류)")
                fail += 1
                continue

            if not generate_thumbnail_from_file(tmp_video, tmp_thumb):
                print("실패 (썸네일 생성 오류)")
                fail += 1
                continue

            with open(tmp_thumb, "rb") as f:
                thumb_bytes = f.read()

            thumb_filename = f"{os.path.splitext(filename)[0]}_thumb.jpg"
            upload_to_s3(thumb_bytes, thumb_filename, "image/jpeg")
            update_thumbnail(video_id, thumb_filename)
            print("완료")
            ok += 1
        finally:
            for p in (tmp_video, tmp_thumb):
                try:
                    os.remove(p)
                except Exception:
                    pass

    print(f"\n결과: 성공 {ok}개 / 실패 {fail}개")


if __name__ == "__main__":
    main()
