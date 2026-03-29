// =====================================================================
// PhotoDetail.jsx — 사진 상세 페이지
// 갤러리에서 사진을 클릭하면 이 페이지로 이동합니다.
// 사진 크게 보기, 좋아요, 태그 편집, 댓글 작성/삭제를 담당합니다.
// =====================================================================

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getPhotoDetail,
  getComments,
  addComment,
  deleteComment,
  toggleLike,
  getLikes,
  getTags,
  updatePhotoTags,
} from "../api";

export default function PhotoDetail() {
  const { id } = useParams(); // URL에서 사진 ID 추출 (예: /photo/42 → id = "42")
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [lightbox, setLightbox] = useState(false); // 이미지 전체화면 보기
  const [photo, setPhoto] = useState(null); // 사진 정보
  const [comments, setComments] = useState([]); // 댓글 목록
  const [commentText, setCommentText] = useState(""); // 댓글 입력창 텍스트
  const [submitting, setSubmitting] = useState(false); // 댓글 전송 중인지 (중복 제출 방지)
  const [liked, setLiked] = useState(false); // 내가 좋아요 눌렀는지
  const [likeCount, setLikeCount] = useState(0); // 좋아요 수
  const [loading, setLoading] = useState(true); // 데이터 로딩 중인지

  // 댓글 페이지네이션 (댓글이 많으면 8개씩 나눠서 표시)
  const [commentPage, setCommentPage] = useState(1);
  const COMMENTS_PER_PAGE = 8;

  // 태그 편집 관련 상태
  const [showTagEdit, setShowTagEdit] = useState(false); // 태그 편집 모달 표시 여부
  const [allTags, setAllTags] = useState([]); // 전체 태그 목록
  const [selectedTagIds, setSelectedTagIds] = useState([]); // 현재 선택된 태그 ID 목록
  const [newTagInput, setNewTagInput] = useState(""); // 새 태그 입력값
  const [tagError, setTagError] = useState(""); // 태그 에러 메시지
  const [tagSaving, setTagSaving] = useState(false); // 태그 저장 중인지

  // ── 초기 데이터 로드 ──────────────────────────────────────
  // 사진 정보, 댓글 목록, 좋아요 정보를 동시에 불러옴
  useEffect(() => {
    if (authLoading) return; // 로그인 정보 복원 중이면 대기
    if (!user) {
      navigate("/");
      return;
    }
    Promise.all([
      getPhotoDetail(id, user.token),
      getComments(id, user.token),
      getLikes(id, user.token),
    ])
      .then(([photoData, commentsData, likesData]) => {
        setPhoto(photoData);
        setComments(commentsData);
        setLikeCount(likesData.count);
        setLiked(likesData.liked);
      })
      .catch(() => navigate("/gallery")) // 오류 시 갤러리로 이동
      .finally(() => setLoading(false));
  }, [id, authLoading, user]);

  // 좋아요 토글
  const handleToggleLike = async () => {
    const res = await toggleLike(id, user.token);
    setLiked(res.liked);
    setLikeCount(res.count);
  };

  // ── 댓글 작성 ───────────────────────────────────────────────
  // submitting 상태로 중복 제출 방지 (Enter 두 번 눌러도 댓글 1개만 올라감)
  const handleAddComment = async () => {
    if (!commentText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const c = await addComment(id, commentText.trim(), user.token);
      setComments((prev) => [...prev, c]);
      setCommentText("");
      // 새 댓글이 있는 마지막 페이지로 이동
      setCommentPage(Math.ceil((comments.length + 1) / COMMENTS_PER_PAGE));
    } finally {
      setSubmitting(false);
    }
  };

  // ── 태그 편집 모달 열기 ────────────────────────────────────
  // 전체 태그 목록을 불러오고 현재 사진의 태그를 선택 상태로 설정
  const openTagEdit = async () => {
    const tags = await getTags(user.token);
    setAllTags(tags);
    setSelectedTagIds(photo.tags ? photo.tags.map((t) => t.id) : []);
    setShowTagEdit(true);
  };

  // ── 태그 저장 ───────────────────────────────────────────────
  // 선택된 태그를 서버에 저장 (기존 태그 ID + 새로 입력한 태그 이름 분리)
  const handleSaveTags = async () => {
    setTagSaving(true);
    try {
      const existingIds = selectedTagIds.filter((id) => typeof id === "number");
      // 'new_태그이름' 형식으로 임시 저장된 새 태그를 이름만 추출
      const newNames = selectedTagIds
        .filter((id) => typeof id === "string" && id.startsWith("new_"))
        .map((id) => id.replace("new_", ""));
      await updatePhotoTags(photo.id, existingIds, newNames, user.token);
      const updated = await getPhotoDetail(photo.id, user.token);
      setPhoto(updated);
      setShowTagEdit(false);
    } finally {
      setTagSaving(false);
    }
  };

  // 태그 선택/해제 토글
  const toggleTagSelect = (id) => {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // 새 태그 입력값 변경 (10글자 초과 시 에러 표시)
  const handleNewTagInput = (val) => {
    setNewTagInput(val);
    setTagError(val.length > 10 ? "태그는 10글자를 초과할 수 없습니다" : "");
  };

  // 새 태그를 임시 목록에 추가 (저장 버튼 누를 때 서버에 실제로 생성됨)
  const handleAddNewTag = () => {
    const name = newTagInput.trim();
    if (!name || name.length > 10) return;
    const tempId = "new_" + name; // 임시 ID (숫자가 아니라 문자열이므로 나중에 구별 가능)
    if (!allTags.find((t) => t.name === name)) {
      setAllTags((prev) => [...prev, { id: tempId, name }]);
    }
    if (!selectedTagIds.includes(tempId)) {
      setSelectedTagIds((prev) => [...prev, tempId]);
    }
    setNewTagInput("");
    setTagError("");
  };

  // 댓글 삭제 (본인 댓글만 가능)
  const handleDeleteComment = async (cid) => {
    await deleteComment(cid, user.token);
    setComments((prev) => prev.filter((c) => c.id !== cid));
  };

  // 날짜를 YYYY.MM.DD 형식으로 변환
  const dateLabel = (iso) => {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };

  if (loading) return <div className="detail-loading">로딩 중…</div>;
  if (!photo) return null;

  // 댓글 페이지네이션 계산
  const totalCommentPages = Math.ceil(comments.length / COMMENTS_PER_PAGE);
  const pagedComments = comments.slice(
    (commentPage - 1) * COMMENTS_PER_PAGE,
    commentPage * COMMENTS_PER_PAGE,
  );

  return (
    <div className="detail-page">
      {/* 갤러리로 돌아가기 버튼 — navigate(-1)로 이전 상태(탭/페이지) 그대로 복원 */}
      <button className="detail-back" onClick={() => navigate(-1)}>
        ← 뒤로가기
      </button>

      {/* 왼쪽: 사진 / 오른쪽: 댓글 레이아웃 */}
      <div className="detail-layout">
        {/* ── 왼쪽: 사진 영역 ── */}
        <div className="detail-photo-wrap">
          <div className="detail-media-frame">
            {photo.media_type === "video" ? (
              <video src={photo.url} controls className="detail-media" />
            ) : (
              <img
                src={photo.url}
                alt={photo.original_filename}
                className="detail-media"
                style={{ cursor: "zoom-in" }}
                onClick={() => setLightbox(true)}
              />
            )}
          </div>

          {/* 라이트박스 — 이미지 클릭 시 전체화면으로 표시 */}
          {lightbox && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.92)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
                cursor: "zoom-out",
              }}
              onClick={() => setLightbox(false)}
            >
              <img
                src={photo.url}
                alt={photo.original_filename}
                style={{
                  maxWidth: "95vw",
                  maxHeight: "95vh",
                  objectFit: "contain",
                  borderRadius: "8px",
                }}
              />
            </div>
          )}

          {/* 파일명, 날짜, 다운로드 버튼 */}
          <div className="detail-photo-info">
            <span className="detail-filename"></span>
            <span className="detail-date">{dateLabel(photo.date_taken)}</span>
            <button
              className="btn btn-ghost"
              style={{ padding: "0.3rem 0.8rem", fontSize: "0.8rem" }}
              onClick={async () => {
                try {
                  const res = await fetch(`/api/photos/${photo.id}/download`, {
                    headers: { "x-user-token": user.token },
                  });
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = photo.original_filename;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch {
                  alert("다운로드에 실패했습니다.");
                }
              }}
            >
              ↓ 다운로드
            </button>
          </div>

          {/* 태그 목록 — 사진 작성자에게만 "태그 편집" 버튼 표시 */}
          <div className="detail-tags">
            {photo.tags &&
              photo.tags.map((t) => (
                <span key={t.id} className="detail-tag">
                  #{t.name}
                </span>
              ))}
            <button className="detail-tag-edit" onClick={openTagEdit}>
              태그 편집
            </button>
          </div>

          {/* 태그 편집 모달 — 바깥 클릭 시 닫힘 */}
          {showTagEdit && (
            <div
              className="modal-overlay"
              onClick={() => setShowTagEdit(false)}
            >
              <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <h3>태그 편집</h3>
                {/* 기존 태그 목록 — 클릭으로 선택/해제 */}
                <div className="tag-pill-list">
                  {allTags.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`tag-pill${selectedTagIds.includes(t.id) ? " selected" : ""}`}
                      onClick={() => toggleTagSelect(t.id)}
                    >
                      #{t.name}
                    </button>
                  ))}
                </div>
                {/* 새 태그 입력 — Enter 키로 추가 (한글 입력 중 오류 방지 처리 포함) */}
                <div className="tag-input-row">
                  <input
                    className="auth-input"
                    placeholder="새 태그 입력"
                    value={newTagInput}
                    onChange={(e) => handleNewTagInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      !e.nativeEvent.isComposing &&
                      handleAddNewTag()
                    }
                    style={{ flex: 1 }}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={handleAddNewTag}
                    disabled={!newTagInput.trim() || newTagInput.length > 10}
                  >
                    추가
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setNewTagInput("");
                      setTagError("");
                    }}
                  >
                    취소
                  </button>
                </div>
                {tagError && <span className="error-msg">{tagError}</span>}
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    className="btn btn-primary"
                    onClick={handleSaveTags}
                    disabled={tagSaving}
                    style={{ flex: 1 }}
                  >
                    {tagSaving ? "저장 중…" : "저장"}
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => setShowTagEdit(false)}
                    style={{ flex: 1 }}
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 좋아요 버튼 — 눌린 상태면 꽉 찬 하트(♥), 아니면 빈 하트(♡) */}
          <button
            className={`detail-like-btn${liked ? " liked" : ""}`}
            onClick={handleToggleLike}
          >
            {liked ? "♥" : "♡"} {likeCount}
          </button>
        </div>

        {/* ── 오른쪽: 댓글 영역 ── */}
        <div className="detail-comments-wrap">
          <h3 className="detail-comments-title">
            댓글
            {comments.length > 0 && (
              <span className="detail-comment-count">{comments.length}</span>
            )}
          </h3>

          <div className="detail-comments-list">
            {comments.length === 0 && (
              <p
                className="empty-msg"
                style={{
                  padding: "1rem",
                  fontSize: "0.85rem",
                  textAlign: "center",
                }}
              >
                첫 댓글을 남겨보세요.
              </p>
            )}
            {/* 현재 페이지의 댓글만 표시 */}
            {pagedComments.map((c) => (
              <div key={c.id} className="detail-comment-item">
                <div className="detail-comment-body">
                  <span className="detail-comment-author">{c.user_name}</span>{" "}
                  {/* 이름(호칭) 형식 */}
                  <span className="detail-comment-content">{c.content}</span>
                  <span className="detail-comment-date">
                    {dateLabel(c.created_at)}
                  </span>
                </div>
                {/* 본인 댓글에만 삭제 버튼 표시 */}
                {c.user_id === user.id && (
                  <button
                    className="detail-comment-delete"
                    onClick={() => handleDeleteComment(c.id)}
                    title="삭제"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* 댓글이 8개를 넘으면 페이지 번호 버튼 표시 */}
          {totalCommentPages > 1 && (
            <div className="detail-comment-pages">
              {Array.from({ length: totalCommentPages }, (_, i) => (
                <button
                  key={i + 1}
                  className={`pagination-btn${commentPage === i + 1 ? " active" : ""}`}
                  onClick={() => setCommentPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}

          {/* 댓글 입력 폼 — Enter 키로도 등록 가능 (한글 입력 중 중복 방지 처리 포함) */}
          <div className="detail-comment-form">
            <input
              className="auth-input"
              placeholder="댓글을 입력하세요…"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" &&
                !e.nativeEvent.isComposing &&
                handleAddComment()
              }
            />
            <button
              className="btn btn-primary"
              onClick={handleAddComment}
              disabled={!commentText.trim() || submitting}
            >
              등록
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
