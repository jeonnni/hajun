// =====================================================================
// Gallery.jsx — 메인 갤러리 페이지
// 탭 구성: 홈 / 전체 / 사진 / 동영상 / 앨범 / 좋아요 / 편지
//   - 홈: 이미지 자동 슬라이드쇼
//   - 전체: 모든 미디어
//   - 사진: 이미지만
//   - 동영상: 영상만
//   - 앨범: 태그 목록 표시 → 클릭하면 해당 태그 사진
//   - 좋아요: 내가 좋아요한 것만
//   - 편지: 편지 목록
// =====================================================================

import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getPhotos, uploadPhoto, getTags, createTag, getLetters } from "../api";
import { useAuth } from "../context/AuthContext";
import { useMusic } from "../context/MusicContext";
import PhotoCard from "../components/PhotoCard";

const PHOTOS_PER_PAGE = 16; // 4열 × 4행

// ── 날짜 포맷 ────────────────────────────────────────────────
function fmtDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

// ── 페이지네이션 컴포넌트 ─────────────────────────────────────
function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const getVisiblePages = () => {
    const groupStart = Math.floor((currentPage - 1) / 5) * 5 + 1;
    const groupEnd = Math.min(groupStart + 4, totalPages);
    const pages = [];
    for (let i = groupStart; i <= groupEnd; i++) pages.push(i);
    return pages;
  };

  const visiblePages = getVisiblePages();

  return (
    <nav className="pagination" aria-label="Photo pages">
      <button className="pagination-btn" onClick={() => onPageChange(1)} disabled={currentPage === 1} aria-label="First page">&#171;</button>
      <button className="pagination-btn" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} aria-label="Previous page">&#8249;</button>
      {visiblePages.map((page) => (
        <button
          key={page}
          className={`pagination-btn${currentPage === page ? " active" : ""}`}
          onClick={() => onPageChange(page)}
          aria-current={currentPage === page ? "page" : undefined}
        >
          {page}
        </button>
      ))}
      <button className="pagination-btn" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} aria-label="Next page">&#8250;</button>
      <button className="pagination-btn" onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages} aria-label="Last page">&#187;</button>
    </nav>
  );
}

// ── 홈 슬라이드쇼 컴포넌트 ────────────────────────────────────
function HomeSlideshow({ photos, onPhotoClick }) {
  const [index, setIndex] = useState(0);
  const [timerKey, setTimerKey] = useState(0); // 수동 이동 시 타이머 리셋용

  // 슬라이드 자동 진행 — timerKey가 바뀌면 타이머 재시작
  useEffect(() => {
    if (photos.length === 0) return;
    const id = setInterval(() => {
      setIndex(i => (i + 1) % photos.length);
      setTimerKey(k => k + 1);
    }, 4000);
    return () => clearInterval(id);
  }, [photos.length, timerKey]);

  // photos 바뀌면 인덱스 초기화
  useEffect(() => { setIndex(0); }, [photos]);

  if (photos.length === 0) return <p className="empty-msg">사진이 없습니다. 업로드해보세요.</p>;

  const photo = photos[index];

  const goPrev = () => {
    setIndex(i => (i - 1 + photos.length) % photos.length);
    setTimerKey(k => k + 1);
  };
  const goNext = () => {
    setIndex(i => (i + 1) % photos.length);
    setTimerKey(k => k + 1);
  };

  return (
    <div className="home-slideshow">
      {/* 이미지 + 오버레이 + 프로그레스바 */}
      <div className="home-slide-frame" onClick={() => onPhotoClick(photo.id)}>
        <img
          key={photo.id}
          src={photo.url}
          alt={photo.original_filename}
          className="home-slide-img"
        />
        <div className="home-slide-overlay">
          <span className="home-slide-date"></span>
          <span className="home-slide-counter">{index + 1} / {photos.length}</span>
        </div>
        {/* 프로그레스바 — 프레임 하단 */}
        <div className="home-slide-progress">
          <div
            className="home-slide-progress-bar"
            key={timerKey}
          />
        </div>
      </div>

      {/* 이전/다음 버튼 */}
      <button className="home-slide-btn home-slide-prev" onClick={goPrev} aria-label="이전">&#8249;</button>
      <button className="home-slide-btn home-slide-next" onClick={goNext} aria-label="다음">&#8250;</button>
    </div>
  );
}

export default function Gallery() {
  const navigate = useNavigate();
  const { tab } = useParams();
  const { user, logout, loading: authLoading } = useAuth();
  const { playing, toggle: toggleMusic } = useMusic();

  // 현재 탭은 URL에서 읽음 — 탭 전환 = navigate로 URL 변경
  const activeView = tab || "home";

  const [photos, setPhotos] = useState([]);
  const [totalPhotos, setTotalPhotos] = useState(0);
  const [fetchKey, setFetchKey] = useState(0);
  const [tags, setTags] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [tagInputError, setTagInputError] = useState("");

  const [activeTagId, setActiveTagId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [letters, setLetters] = useState([]);
  const [totalLetters, setTotalLetters] = useState(0);

  // 홈 슬라이드쇼용 이미지 목록
  const [homePhotos, setHomePhotos] = useState([]);

  const fileInputRef = useRef(null);
  const tabsRef = useRef(null);


  // 앨범 탭의 태그 서브메뉴 가로 스크롤
  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const onWheel = (e) => {
      const rect = el.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top && e.clientY <= rect.bottom) {
        e.preventDefault();
        el.scrollLeft += e.deltaY || e.deltaX;
      }
    };
    let isDown = false, startX = 0, scrollLeft = 0;
    const onMouseDown = (e) => { isDown = true; startX = e.pageX - el.offsetLeft; scrollLeft = el.scrollLeft; };
    const onMouseUp = () => { isDown = false; };
    const onMouseMove = (e) => {
      if (!isDown) return;
      e.preventDefault();
      el.scrollLeft = scrollLeft - (e.pageX - el.offsetLeft - startX) * 1.5;
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    el.addEventListener("mousemove", onMouseMove);
    return () => {
      window.removeEventListener("wheel", onWheel);
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  useEffect(() => {
    if (!authLoading && !user) navigate("/");
  }, [user, authLoading, navigate]);



  // 탭(URL) 바뀌면 페이지·태그 초기화
  useEffect(() => {
    setCurrentPage(1);
    setActiveTagId(null);
  }, [activeView]);

  useEffect(() => {
    if (!user) return;
    getTags(user.token).then(setTags).catch(console.error);
  }, [user]);


  // 홈 탭: 이미지만 최대 100장 가져와서 슬라이드쇼에 사용
  useEffect(() => {
    if (!user || activeView !== 'home') return;
    getPhotos(user.token, null, 1, 100, 'image', false)
      .then(data => {
        const shuffled = [...data.items].sort(() => Math.random() - 0.5);
        setHomePhotos(shuffled);
      })
      .catch(console.error);
  }, [user, activeView, fetchKey]);

  // 편지 탭일 때 편지 목록 조회
  useEffect(() => {
    if (!user || activeView !== 'letter') return;
    getLetters(user.token, currentPage, PHOTOS_PER_PAGE)
      .then((data) => {
        setLetters(data.items);
        setTotalLetters(data.total);
      })
      .catch(console.error);
  }, [user, activeView, currentPage, fetchKey]);

  // 사진 탭들 — 홈·편지 탭에서는 실행하지 않음
  useEffect(() => {
    if (!user || activeView === 'home' || activeView === 'letter') return;

    const mediaType = activeView === "photo" ? "image"
                    : activeView === "video" ? "video"
                    : null;
    const likedOnly = activeView === "liked";
    const tagId = activeView === "album" ? activeTagId : null;

    getPhotos(user.token, tagId, currentPage, PHOTOS_PER_PAGE, mediaType, likedOnly)
      .then((data) => {
        setPhotos(data.items);
        setTotalPhotos(data.total);
      })
      .catch(console.error);
  }, [user, activeView, activeTagId, currentPage, fetchKey]);

  // 메인 탭 전환 — URL로 이동 (히스토리에 기록됨)
  const switchView = (view) => {
    navigate(view === 'home' ? '/gallery' : `/gallery/${view}`);
  };

  // 파일 업로드 (여러 장 가능)
  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const failed = [];
    for (let i = 0; i < files.length; i++) {
      setUploadProgress(`${i + 1}/${files.length}`);
      try {
        await uploadPhoto(files[i], user.token);
      } catch {
        failed.push(files[i].name);
      }
    }
    if (failed.length > 0) alert(`업로드 실패:\n${failed.join("\n")}`);
    setUploadProgress(null);
    e.target.value = "";
    setCurrentPage(1);
    setFetchKey((k) => k + 1);
  };

  // 사진 카드 업데이트 (좋아요/삭제 요청 후 반영)
  const handleUpdate = (updated) => {
    setPhotos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  // 태그 생성
  const handleCreateTag = async (e) => {
    e.preventDefault();
    const name = newTagName.trim();
    if (!name) return;
    if (name.length > 10) { setTagInputError("태그는 10글자를 초과할 수 없습니다"); return; }
    try {
      const tag = await createTag(name, user.token);
      setTags((prev) => prev.find((t) => t.id === tag.id) ? prev : [...prev, tag]);
      setNewTagName("");
      setShowTagInput(false);
      setTagInputError("");
    } catch (err) {
      alert(err.response?.data?.detail || "태그 생성 실패");
    }
  };

  const handleLogout = () => {
    if (!confirm("정말 로그아웃하시겠습니까?")) return;
    logout();
    navigate("/");
  };

  const totalPages = Math.ceil(totalPhotos / PHOTOS_PER_PAGE);
  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (authLoading) return null;

  // 메인 탭 목록
  const mainTabs = [
    { id: "home",   label: "홈" },
    { id: "all",    label: "전체" },
    { id: "photo",  label: "사진" },
    { id: "video",  label: "동영상" },
    { id: "album",  label: "앨범" },
    { id: "letter", label: "편지" },
    { id: "liked",  label: "♥" },
  ];

  return (
    <div className={`page${activeView === 'home' ? ' page-home' : ''}`}>
      <header>
        {/* 데스크탑: 텍스트 제목 / 모바일: 로고 이미지 (클릭 시 음악 토글) */}
        <h1 className="header-title-desktop">호빵이</h1>
        <img
          src="/logo.png"
          alt="호빵이"
          className={`header-logo-mobile${playing ? " logo-playing" : ""}`}
          onClick={toggleMusic}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div className="header-user">
            <span>{user?.name}님</span>
          </div>
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          <button
            className="btn btn-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadProgress !== null}
          >
            {uploadProgress ? `${uploadProgress} 업로드 중…` : "업로드"}
          </button>
          <button className="btn btn-ghost" onClick={handleLogout}>
            로그아웃
          </button>
        </div>
      </header>

      {/* ── 메인 탭 ── */}
      <div className="folder-tabs">
        {mainTabs.map((tab) => (
          <button
            key={tab.id}
            className={`folder-tab${activeView === tab.id ? " active" : ""}`}
            onClick={() => switchView(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── 앨범 탭 선택 시: 태그 서브메뉴 ── */}
      {activeView === "album" && (
        <div className="folder-tabs album-subtabs" ref={tabsRef}>
          <button
            className={`folder-tab${activeTagId === null ? " active" : ""}`}
            onClick={() => { setActiveTagId(null); setCurrentPage(1); }}
          >
            전체
          </button>
          {tags.map((tag) => (
            <button
              key={tag.id}
              className={`folder-tab${activeTagId === tag.id ? " active" : ""}`}
              onClick={() => { setActiveTagId(tag.id); setCurrentPage(1); }}
            >
              #{tag.name}
            </button>
          ))}
          {showTagInput ? (
            <form className="folder-create-input" onSubmit={handleCreateTag}>
              <input
                type="text"
                placeholder="태그 이름 (10자 이하)"
                value={newTagName}
                onChange={(e) => {
                  setNewTagName(e.target.value);
                  setTagInputError(e.target.value.length > 10 ? "태그는 10글자를 초과할 수 없습니다" : "");
                }}
                autoFocus
                onBlur={() => { if (!newTagName) setShowTagInput(false); }}
              />
              <button className="btn btn-primary" type="submit"
                style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem" }}
                disabled={!newTagName.trim() || newTagName.length > 10}>
                추가
              </button>
              <button type="button" className="btn btn-ghost"
                style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem" }}
                onClick={() => { setShowTagInput(false); setNewTagName(""); setTagInputError(""); }}>
                취소
              </button>
              {tagInputError && <span className="error-msg" style={{ fontSize: "0.75rem" }}>{tagInputError}</span>}
            </form>
          ) : (
            <button className="folder-tab-add" onClick={() => setShowTagInput(true)}>
              + 태그
            </button>
          )}
        </div>
      )}

      {/* ── 홈 탭: 슬라이드쇼 ── */}
      {activeView === "home" && (
        <HomeSlideshow
          photos={homePhotos}
          onPhotoClick={(id) => navigate(`/photo/${id}`)}
        />
      )}

      {/* ── 편지 탭 ── */}
      {activeView === "letter" && (
        <>
          <div className="letter-list-header">
            <button
              className="btn btn-primary"
              onClick={() => navigate("/letter/write")}
            >
              편지 쓰기
            </button>
          </div>
          {letters.length === 0 ? (
            <p className="empty-msg">아직 편지가 없습니다. 첫 편지를 써보세요.</p>
          ) : (
            <>
              <table className="letter-table">
                <thead>
                  <tr>
                    <th className="letter-col-no">번호</th>
                    <th className="letter-col-title">제목</th>
                    <th className="letter-col-author">작성자</th>
                  </tr>
                </thead>
                <tbody>
                  {letters.map((letter) => (
                    <tr
                      key={letter.id}
                      className="letter-row"
                      onClick={() => navigate(`/letter/${letter.id}`)}
                    >
                      <td className="letter-col-no">{letter.id}</td>
                      <td className="letter-col-title">{letter.title}</td>
                      <td className="letter-col-author">{letter.user_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(totalLetters / PHOTOS_PER_PAGE)}
                onPageChange={handlePageChange}
              />
            </>
          )}
        </>
      )}

      {/* ── 사진 그리드 (홈·편지 제외) ── */}
      {activeView !== "home" && activeView !== "letter" && (
        photos.length === 0 ? (
          <p className="empty-msg">
            {activeView === "liked" ? "좋아요한 사진이 없습니다." : "사진이 없습니다. 업로드해보세요."}
          </p>
        ) : (
          <>
            <div className="photo-grid">
              {photos.map((photo) => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  onUpdate={handleUpdate}
                  token={user.token}
                  currentUserId={user.id}
                />
              ))}
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </>
        )
      )}

    </div>
  );
}
