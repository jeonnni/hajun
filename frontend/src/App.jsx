// =====================================================================
// App.jsx — 앱 전체 진입점
// =====================================================================

import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { MusicProvider, useMusic } from './context/MusicContext'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Gallery from './pages/Gallery'
import Admin from './pages/Admin'
import PhotoDetail from './pages/PhotoDetail'
import LetterWrite from './pages/LetterWrite'
import LetterDetail from './pages/LetterDetail'

// 데스크탑에서만 보이는 음악 버튼 (모바일은 로고로 제어)
function MusicButton() {
  const { playing, toggle } = useMusic()

  return (
    <button
      onClick={toggle}
      className={`music-btn${playing ? ' music-playing' : ''}`}
      title={playing ? '음악 정지' : '음악 재생'}
    >
      {playing ? (
        <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
          <rect x="6" y="4" width="4" height="16" rx="1"/>
          <rect x="14" y="4" width="4" height="16" rx="1"/>
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
          <path d="M9 18V6l10 6-10 6z"/>
        </svg>
      )}
    </button>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <MusicProvider>
        <Routes>
          <Route path="/"          element={<Landing />} />
          <Route path="/login"     element={<Login />} />
          <Route path="/gallery"   element={<Gallery />} />
          <Route path="/gallery/:tab"  element={<Gallery />} />
          <Route path="/admin"     element={<Admin />} />
          <Route path="/photo/:id" element={<PhotoDetail />} />
          <Route path="/letter/write"  element={<LetterWrite />} />
          <Route path="/letter/:id"    element={<LetterDetail />} />
        </Routes>
        <MusicButton />
      </MusicProvider>
    </AuthProvider>
  )
}
