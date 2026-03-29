// =====================================================================
// PhotoCard.jsx — 갤러리에서 사진 한 장을 보여주는 카드 컴포넌트
// 사진 썸네일, 날짜, 파일명, 좋아요 버튼, 삭제 요청 버튼을 표시합니다.
// 사진을 클릭하면 상세 페이지로 이동합니다.
// =====================================================================

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { requestDeletion, cancelDeletion, toggleLike } from '../api'

// props 설명:
//   photo        — 사진 데이터 객체 (id, filename, date_taken, like_count, liked, user_id 등)
//   onUpdate     — 이 사진의 데이터가 바뀌었을 때 갤러리에 알려주는 함수
//   token        — 현재 로그인된 사용자의 인증 토큰
//   currentUserId — 현재 로그인된 사용자의 ID (본인 사진인지 확인용)
export default function PhotoCard({ photo, onUpdate, token, currentUserId }) {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)               // 삭제 요청 처리 중인지
  const [thumbError, setThumbError] = useState(false)         // 동영상 썸네일 로드 실패 여부
  const [liked, setLiked] = useState(photo.liked ?? false)    // 내가 좋아요 눌렀는지 (서버에서 받은 초기값)
  const [likeCount, setLikeCount] = useState(photo.like_count ?? 0)  // 좋아요 총 개수

  // 삭제 대기 중인 사진인지 확인
  const isPending = photo.status === 'pending_deletion'

  // 날짜 표시 형식: YYYY.MM.DD
  const dateLabel = (() => {
    const d = new Date(photo.date_taken)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}.${mm}.${dd}`
  })()

  // ── 삭제 요청 ────────────────────────────────────────────────
  const handleRequestDeletion = async () => {
    setLoading(true)
    try {
      const updated = await requestDeletion(photo.id, token)
      onUpdate(updated)
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to request deletion')
    } finally {
      setLoading(false)
    }
  }

  // ── 삭제 요청 취소 ───────────────────────────────────────────
  const handleCancelDeletion = async () => {
    setLoading(true)
    try {
      const updated = await cancelDeletion(photo.id, token)
      onUpdate(updated)
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to cancel deletion')
    } finally {
      setLoading(false)
    }
  }

  // ── 좋아요 토글 ──────────────────────────────────────────────
  // 낙관적 업데이트: 서버 응답을 기다리지 않고 UI를 먼저 변경,
  // 실패하면 원래 상태로 되돌림
  const handleToggleLike = async () => {
    const wasLiked = liked
    setLiked(!wasLiked)                                   // UI 먼저 변경
    setLikeCount(c => wasLiked ? c - 1 : c + 1)
    try {
      const data = await toggleLike(photo.id, token)     // 서버에 좋아요 토글 요청
      setLiked(data.liked)                               // 서버 응답으로 최종 동기화
      setLikeCount(data.count)
    } catch (err) {
      // 실패 시 원래 상태로 복구
      setLiked(wasLiked)
      setLikeCount(c => wasLiked ? c + 1 : c - 1)
    }
  }

  // ── 미디어 요소 ──────────────────────────────────────────────
  // 갤러리 카드에는 항상 썸네일 이미지 사용 (빠른 로딩)
  // 동영상도 업로드 시 생성된 썸네일 이미지를 표시하고, 재생 아이콘으로 동영상임을 표시
  const mediaEl = photo.media_type === 'video'
    ? (
      <div style={{ position: 'relative', width: '100%', aspectRatio: '1' }}>
        {thumbError ? (
          <div style={{ width: '100%', height: '100%', background: '#2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
        ) : (
          <img
            src={photo.thumbnail_url || photo.url}
            alt={photo.original_filename}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={() => setThumbError(true)}
          />
        )}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg viewBox="0 0 24 24" fill="white" width="18" height="18">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </div>
      </div>
    )
    : (
      <img
        src={photo.thumbnail_url || photo.url}
        alt={photo.original_filename}
        loading="lazy"
      />
    )

  return (
    <div className="photo-card">
      {/* 사진/영상 클릭 시 상세 페이지로 이동 — onClick은 div 하나에만 */}
      <div
        style={{ cursor: "pointer" }}
        onClick={() => {
          sessionStorage.setItem('galleryRestoreState', 'true')
          navigate(`/photo/${photo.id}`)
        }}
      >
        {mediaEl}
      </div>

      <div className="photo-card-body">
        <span className="date">{dateLabel}</span>
        {/* 하단 액션 버튼 영역 */}
        <div className="photo-card-actions">
          {/* 좋아요 버튼 — 눌린 상태면 빨간색으로 표시 */}
          <button
            className={`action-btn${liked ? " liked" : ""}`}
            onClick={handleToggleLike}
          >
            ♥ {likeCount}
          </button>

          {/* 삭제 관련 버튼 영역 */}
          {isPending ? (
            <button
              className="action-btn action-btn-cancel"
              onClick={handleCancelDeletion}
              disabled={loading}
              title="삭제 취소"
            >
              삭제 취소
            </button>
          ) : currentUserId === photo.user_id ? (
            // 본인이 올린 사진에만 삭제 요청 버튼(휴지통 아이콘) 표시
            <button
              className="action-btn action-btn-delete"
              onClick={handleRequestDeletion}
              disabled={loading}
              title="삭제 요청"
            >
              🗑
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
