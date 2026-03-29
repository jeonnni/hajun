# =====================================================================
# s3.py — AWS S3 연동 유틸리티
# 파일 업로드, 삭제, URL 생성, 썸네일 생성 함수를 제공합니다.
# photos.py와 admin.py에서 import해서 사용합니다.
# =====================================================================

import io
import os
import subprocess
import tempfile

import boto3
from PIL import Image

# 환경변수에서 AWS 설정 로드
AWS_REGION     = os.getenv("AWS_REGION", "ap-northeast-2")
S3_BUCKET      = os.getenv("S3_BUCKET_NAME", "")
CLOUDFRONT_URL = os.getenv("CLOUDFRONT_URL", "").rstrip("/")

# 썸네일 최대 크기 (가로 또는 세로가 이 크기를 넘으면 비율 유지하며 축소)
THUMB_SIZE = (400, 400)


def _s3():
    """boto3 S3 클라이언트를 생성해서 반환합니다."""
    return boto3.client(
        "s3",
        region_name=AWS_REGION,
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    )


def get_file_url(filename: str) -> str:
    """
    파일명으로 접근 가능한 URL을 반환합니다.
    CLOUDFRONT_URL이 설정되어 있으면 CloudFront URL, 없으면 S3 직접 URL을 반환합니다.
    """
    if CLOUDFRONT_URL:
        return f"{CLOUDFRONT_URL}/{filename}"
    return f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{filename}"


def upload_to_s3(file_bytes: bytes, filename: str, content_type: str = "application/octet-stream") -> None:
    """
    파일을 S3 버킷에 업로드합니다.
    업로드된 파일은 퍼블릭 읽기 가능 상태로 설정됩니다.
    """
    _s3().put_object(
        Bucket=S3_BUCKET,
        Key=filename,
        Body=file_bytes,
        ContentType=content_type,
    )


def delete_from_s3(filename: str) -> None:
    """
    S3 버킷에서 파일을 삭제합니다.
    파일이 없거나 오류가 발생해도 예외를 던지지 않습니다.
    """
    if not filename:
        return
    try:
        _s3().delete_object(Bucket=S3_BUCKET, Key=filename)
    except Exception:
        pass


def generate_thumbnail(file_bytes: bytes) -> bytes | None:
    """
    이미지 파일을 받아 400×400 이내의 JPEG 썸네일을 생성합니다.
    비율은 유지하며, 실패하면 None을 반환합니다.
    """
    try:
        img = Image.open(io.BytesIO(file_bytes))
        img.thumbnail(THUMB_SIZE, Image.LANCZOS)
        # 투명도가 있는 PNG/GIF 등은 JPEG 저장을 위해 RGB로 변환
        if img.mode in ("RGBA", "P", "LA"):
            img = img.convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85, optimize=True)
        return buf.getvalue()
    except Exception:
        return None


def generate_video_thumbnail(file_bytes: bytes) -> bytes | None:
    """
    동영상 파일에서 ffmpeg로 프레임을 추출해 JPEG 썸네일을 생성합니다.
    1초 지점 추출 실패 시 0초(첫 프레임)로 재시도합니다.
    ffmpeg가 없거나 실패하면 None을 반환합니다.
    """
    tmp_in_path = tmp_out_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp_in:
            tmp_in.write(file_bytes)
            tmp_in_path = tmp_in.name

        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp_out:
            tmp_out_path = tmp_out.name

        for ss in ("00:00:01", "00:00:00"):
            subprocess.run(
                [
                    "ffmpeg", "-y",
                    "-i", tmp_in_path,
                    "-ss", ss,
                    "-vframes", "1",
                    "-vf", f"scale={THUMB_SIZE[0]}:{THUMB_SIZE[1]}:force_original_aspect_ratio=decrease",
                    tmp_out_path,
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=30,
            )
            if os.path.exists(tmp_out_path) and os.path.getsize(tmp_out_path) > 0:
                break

        if not os.path.exists(tmp_out_path) or os.path.getsize(tmp_out_path) == 0:
            return None

        with open(tmp_out_path, "rb") as f:
            return f.read()
    except Exception:
        return None
    finally:
        for path in (tmp_in_path, tmp_out_path):
            try:
                if path:
                    os.remove(path)
            except Exception:
                pass
