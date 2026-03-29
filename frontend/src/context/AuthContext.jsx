// =====================================================================
// AuthContext.jsx — 로그인 상태 전역 관리
// 일반 사용자 로그인 정보와 관리자 로그인 정보를
// 앱 전체에서 어디서든 꺼내 쓸 수 있도록 보관합니다.
// 브라우저를 새로고침해도 로그인 상태가 유지되도록 localStorage에 저장합니다.
// =====================================================================

import { createContext, useContext, useState, useEffect } from 'react'
import { getMe } from '../api'

// 전역으로 공유할 "인증 저장소" 생성
const AuthContext = createContext(null)

// ── AuthProvider ────────────────────────────────────────────────
// 이 컴포넌트로 앱을 감싸면 하위 컴포넌트 어디서든 로그인 정보에 접근 가능
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)       // 현재 로그인된 일반 사용자 정보
  const [adminKey, setAdminKey] = useState(null) // 관리자 인증 키
  const [loading, setLoading] = useState(true)   // 저장된 로그인 정보를 불러오는 중인지 여부

  // 앱 시작 시 localStorage에 저장된 로그인 정보를 복원 + 토큰 유효성 검증
  useEffect(() => {
    const storedUser  = localStorage.getItem('user')
    const storedToken = localStorage.getItem('token')
    const storedAdmin = localStorage.getItem('adminKey')

    if (storedAdmin) setAdminKey(storedAdmin)

    if (storedUser && storedToken) {
      // 서버에 토큰 유효성 확인 — 다른 기기 로그인으로 토큰이 바뀌었을 수 있음
      getMe(storedToken)
        .then((freshUser) => {
          // 서버에서 최신 사용자 정보로 갱신
          setUser({ ...freshUser, token: storedToken })
          localStorage.setItem('user', JSON.stringify(freshUser))
        })
        .catch(() => {
          // 토큰 무효 → 로컬 데이터 제거 (조용히 로그아웃)
          localStorage.removeItem('token')
          localStorage.removeItem('user')
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  // API에서 401이 오면 자동 로그아웃 (axios interceptor가 이 이벤트를 발생시킴)
  useEffect(() => {
    const handleUnauthorized = () => {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setUser(null)
    }
    window.addEventListener('auth:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized)
  }, [])

  // 일반 사용자 로그인 — 토큰과 사용자 정보를 저장
  const loginUser = (token, userData) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser({ ...userData, token })
  }

  // 관리자 로그인 — 관리자 키를 저장
  const loginAdmin = (key) => {
    localStorage.setItem('adminKey', key)
    setAdminKey(key)
  }

  // 일반 사용자 로그아웃 — 저장된 정보 삭제
  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  // 관리자 로그아웃 — 관리자 키 삭제
  const logoutAdmin = () => {
    localStorage.removeItem('adminKey')
    setAdminKey(null)
  }

  return (
    // 하위 컴포넌트들이 user, adminKey, 각종 함수들을 꺼내 쓸 수 있게 제공
    <AuthContext.Provider value={{ user, adminKey, loading, loginUser, loginAdmin, logout, logoutAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

// useAuth() 훅 — 컴포넌트에서 "const { user } = useAuth()" 형태로 사용
export const useAuth = () => useContext(AuthContext)
