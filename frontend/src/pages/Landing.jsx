// =====================================================================
// Landing.jsx — 시작 화면 (메인 페이지)
// =====================================================================

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Landing() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()

  // 이미 로그인된 상태면 갤러리로 바로 이동 (히스토리 대체)
  useEffect(() => {
    if (!loading && user) navigate('/gallery', { replace: true })
  }, [user, loading])

  if (loading || user) return null

  return (
    <div className="landing-page">
      <img src="/logo.png" alt="로고" className="landing-logo" />

      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <h1 className="landing-title">서하준</h1>
        <p className="landing-subtitle">따뜻한 기억을 이어가기 위한 공간입니다</p>
      </div>

      <div className="landing-buttons">
        <button className="btn btn-primary" onClick={() => navigate("/login", { replace: true })}>
          로그인
        </button>
      </div>
    </div>
  )
}
