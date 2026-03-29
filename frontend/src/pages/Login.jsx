// =====================================================================
// Login.jsx — 로그인 / 회원가입 화면
// 전화번호로 로그인하거나, 이름+전화번호로 회원가입 신청을 합니다.
// 회원가입 후에는 관리자 승인이 있어야 로그인할 수 있습니다.
//
// 특수 기능:
//   - 전화번호 입력 시 하이픈 자동 삽입 (010-1234-5678)
//   - 전화번호 입력란에 "admin" 입력 시 관리자 로그인 화면으로 전환
// =====================================================================

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, register, adminLogin } from '../api'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const { user, loading, loginUser, loginAdmin, logout } = useAuth()

  // 이미 로그인된 상태에서 로그인 페이지 접근 시 갤러리로 이동
  useEffect(() => {
    if (loading) return
    if (user) navigate('/gallery', { replace: true })
  }, [user, loading])

  // 현재 모드: 'login'(로그인) | 'register'(회원가입) | 'admin'(관리자 로그인)
  const [mode, setMode] = useState('login')

  // 일반 로그인/회원가입 상태
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 관리자 로그인 상태
  const [adminUsername, setAdminUsername] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminError, setAdminError] = useState('')
  const [adminLoading, setAdminLoading] = useState(false)

  // ── 전화번호 입력 처리 ────────────────────────────────────────
  // 숫자 입력 시 하이픈 자동 삽입 (010-1234-5678)
  // "admin" 입력 시 관리자 로그인 모드로 전환
  const handlePhoneChange = (e) => {
    const raw = e.target.value

    // "admin" 감지 → 관리자 로그인 모드로 전환
    if (raw.toLowerCase() === 'admin') {
      setMode('admin')
      setPhone('')
      setError('')
      return
    }

    // 영문자가 포함된 경우 (admin 입력 중) → 그대로 유지
    if (/[a-zA-Z]/.test(raw)) {
      setPhone(raw)
      return
    }

    // 숫자만 추출 후 최대 11자리
    const digits = raw.replace(/\D/g, '').slice(0, 11)

    // 하이픈 자동 삽입 (010-1234-5678 형식)
    let formatted = digits
    if (digits.length > 7) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
    } else if (digits.length > 3) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`
    }
    setPhone(formatted)
  }

  // ── 로그인 처리 ────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const data = await login(phone)
      loginUser(data.token, data.user)
      navigate('/gallery', { replace: true })
    } catch (err) {
      const status = err.response?.status
      const detail = err.response?.data?.detail || ''
      if (status === 403) {
        if (detail.toLowerCase().includes('pending') || detail.toLowerCase().includes('대기')) {
          setError('승인 대기 중입니다. 관리자 승인 후 이용 가능합니다.')
        } else {
          setError('접근이 거부되었습니다.')
        }
      } else if (status === 404) {
        setError('등록되지 않은 번호입니다')
      } else {
        setError('로그인에 실패했습니다')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── 회원가입 처리 ──────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      await register(name, phone)
      setSuccess('회원가입 신청이 완료됐습니다.\n관리자 승인 후 로그인하실 수 있습니다.')
      setName('')
      setPhone('')
    } catch (err) {
      const status = err.response?.status
      if (status === 409) {
        setError('이미 등록된 전화번호입니다')
      } else {
        setError('회원가입에 실패했습니다')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── 관리자 로그인 처리 ────────────────────────────────────
  const handleAdminLogin = async (e) => {
    e.preventDefault()
    setAdminError('')
    setAdminLoading(true)
    try {
      const data = await adminLogin(adminUsername, adminPassword)
      loginAdmin(data.admin_token)
      navigate('/admin', { replace: true })
    } catch (err) {
      const status = err.response?.status
      setAdminError(status === 401 || status === 403 ? '아이디 또는 비밀번호가 틀렸습니다' : '연결 오류')
    } finally {
      setAdminLoading(false)
    }
  }

  // 로그인 ↔ 회원가입 모드 전환
  const switchMode = () => {
    setMode(m => m === 'login' ? 'register' : 'login')
    setError('')
    setSuccess('')
    setPhone('')
  }

  // ── 관리자 로그인 화면 ────────────────────────────────────
  if (mode === 'admin') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              className="btn btn-ghost"
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
              onClick={() => { setMode('login'); setAdminError(''); setAdminUsername(''); setAdminPassword('') }}
            >
              ← 뒤로
            </button>
          </div>

          <h2>관리자 로그인</h2>

          <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <input
              className="auth-input"
              type="text"
              placeholder="아이디"
              value={adminUsername}
              onChange={e => setAdminUsername(e.target.value)}
              autoFocus
              required
            />
            <input
              className="auth-input"
              type="password"
              placeholder="비밀번호"
              value={adminPassword}
              onChange={e => setAdminPassword(e.target.value)}
              required
            />
            {adminError && <span className="error-msg">{adminError}</span>}
            <button
              className="btn btn-primary"
              type="submit"
              disabled={adminLoading || !adminUsername || !adminPassword}
            >
              {adminLoading ? '로그인 중…' : '로그인'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── 일반 로그인 / 회원가입 화면 ──────────────────────────
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            className="btn btn-ghost"
            style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
            onClick={() => navigate('/')}
          >
            ← 뒤로
          </button>
        </div>

        <h2 style={{ textAlign: 'center' }}>{mode === 'login' ? '로그인' : '회원가입'}</h2>

        {/* 회원가입 성공 메시지 */}
        {success && mode === 'register' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', textAlign: 'center' }}>
            <div className="auth-success">{success}</div>
            <button className="btn btn-primary" onClick={() => { setSuccess(''); setMode('login') }}>
              로그인하기
            </button>
          </div>
        ) : null}

        <form
          onSubmit={mode === 'login' ? handleLogin : handleRegister}
          style={{ display: success && mode === 'register' ? 'none' : 'flex', flexDirection: 'column', gap: '0.75rem' }}
        >
          {/* 회원가입 모드일 때만 이름 입력 필드 표시 */}
          {mode === 'register' && (
            <input
              className="auth-input"
              type="text"
              placeholder="이름"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
            />
          )}

          {/* 전화번호 입력 — 하이픈 자동 삽입, "admin" 입력 시 관리자 모드 전환 */}
          <input
            className="auth-input"
            type="text"
            placeholder="전화번호 (예: 010-1234-5678)"
            value={phone}
            onChange={handlePhoneChange}
            required
            autoFocus={mode === 'login'}
          />

          {error && <span className="error-msg">{error}</span>}

          <button
            className="btn btn-primary"
            type="submit"
            disabled={submitting || !phone || (mode === 'register' && !name)}
          >
            {submitting ? '처리 중…' : mode === 'login' ? '로그인' : '회원가입 신청'}
          </button>
        </form>

        {!(success && mode === 'register') && (
          <div className="auth-toggle">
            {mode === 'login' ? (
              <>계정이 없으신가요?{' '}<button onClick={switchMode}>회원가입</button></>
            ) : (
              <>이미 계정이 있으신가요?{' '}<button onClick={switchMode}>로그인</button></>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
