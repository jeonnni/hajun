// =====================================================================
// Admin.jsx — 관리자 페이지
// 관리자(admin/0711)가 로그인 후 사용하는 페이지입니다.
// 탭 구성:
//   1. 회원 승인 대기 — 신규 가입자를 승인/거절
//   2. 삭제 요청     — 사진 삭제 요청을 승인(실제 삭제)/거절(복원)
//   3. 태그 관리     — 태그 추가/수정/삭제
//   4. 회원 호칭     — 승인된 회원에게 호칭 지정 (예: 홍길동(삼촌))
// =====================================================================

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminLogin, getPending, handlePhotoAction, getPendingUsers, handleUserAction, adminGetTags, adminCreateTag, adminUpdateTag, adminDeleteTag, adminGetAllUsers, adminSetUserTitle } from '../api'
import { useAuth } from '../context/AuthContext'

export default function Admin() {
  const navigate = useNavigate()
  const { adminKey, loginAdmin, logoutAdmin } = useAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  const [activeTab, setActiveTab] = useState('users') // 'users' | 'photos' | 'tags' | 'titles'
  const [pendingUsers, setPendingUsers] = useState([])
  const [pendingPhotos, setPendingPhotos] = useState([])
  const [dataLoading, setDataLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)

  // 회원 호칭 관리
  const [allUsers, setAllUsers] = useState([])
  const [editingTitleId, setEditingTitleId] = useState(null)
  const [editingTitleValue, setEditingTitleValue] = useState('')
  const [titleLoading, setTitleLoading] = useState(false)

  // 태그 관리
  const [tags, setTags] = useState([])
  const [newTagName, setNewTagName] = useState('')
  const [newTagError, setNewTagError] = useState('')
  const [editingTagId, setEditingTagId] = useState(null)
  const [editingTagName, setEditingTagName] = useState('')
  const [editingTagError, setEditingTagError] = useState('')
  const [tagLoading, setTagLoading] = useState(false)

  // 관리자 로그인 후 필요한 모든 데이터를 한번에 불러옴
  useEffect(() => {
    if (!adminKey) return
    setDataLoading(true)
    Promise.all([
      getPendingUsers(adminKey).catch(() => []),   // 승인 대기 회원
      getPending(adminKey).catch(() => []),         // 삭제 요청 사진
      adminGetTags(adminKey).catch(() => []),       // 전체 태그 목록
      adminGetAllUsers(adminKey).catch(() => []),   // 승인된 전체 회원 목록
    ]).then(([users, photos, tagList, userList]) => {
      setPendingUsers(users)
      setPendingPhotos(photos)
      setTags(tagList)
      setAllUsers(userList)
    }).finally(() => setDataLoading(false))
  }, [adminKey])

  // ── 회원 호칭 저장 ────────────────────────────────────────────
  // 입력한 호칭을 서버에 저장하고 화면의 회원 목록을 즉시 업데이트합니다.
  const handleSaveTitle = async (userId) => {
    setTitleLoading(true)
    try {
      const updated = await adminSetUserTitle(userId, editingTitleValue, adminKey)
      setAllUsers(prev => prev.map(u => u.id === userId ? updated : u))
      setEditingTitleId(null)
      setEditingTitleValue('')
    } catch (err) {
      alert(err.response?.data?.detail || '호칭 저장 실패')
    } finally {
      setTitleLoading(false)
    }
  }

  // ── 회원 호칭 제거 ────────────────────────────────────────────
  // 빈 문자열을 전송해서 서버의 호칭을 null로 초기화합니다.
  const handleRemoveTitle = async (userId) => {
    setTitleLoading(true)
    try {
      const updated = await adminSetUserTitle(userId, '', adminKey)
      setAllUsers(prev => prev.map(u => u.id === userId ? updated : u))
    } catch (err) {
      alert(err.response?.data?.detail || '호칭 삭제 실패')
    } finally {
      setTitleLoading(false)
    }
  }

  // ── 태그 생성 ─────────────────────────────────────────────────
  // 새 태그를 추가하고 이름순으로 목록을 정렬합니다.
  const handleCreateTag = async (e) => {
    e.preventDefault()
    const name = newTagName.trim()
    if (!name) return
    if (name.length > 10) { setNewTagError('태그는 10글자를 초과할 수 없습니다'); return }
    setTagLoading(true)
    try {
      const tag = await adminCreateTag(name, adminKey)
      setTags(prev => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)))
      setNewTagName('')
      setNewTagError('')
    } catch (err) {
      setNewTagError(err.response?.data?.detail || '태그 생성 실패')
    } finally {
      setTagLoading(false)
    }
  }

  // ── 태그 수정 ─────────────────────────────────────────────────
  // 태그 이름을 변경하고 수정 완료 후 편집 모드를 닫습니다.
  const handleUpdateTag = async (id) => {
    const name = editingTagName.trim()
    if (!name) return
    if (name.length > 10) { setEditingTagError('태그는 10글자를 초과할 수 없습니다'); return }
    setTagLoading(true)
    try {
      const updated = await adminUpdateTag(id, name, adminKey)
      setTags(prev => prev.map(t => t.id === id ? updated : t).sort((a, b) => a.name.localeCompare(b.name)))
      setEditingTagId(null)
      setEditingTagName('')
      setEditingTagError('')
    } catch (err) {
      setEditingTagError(err.response?.data?.detail || '수정 실패')
    } finally {
      setTagLoading(false)
    }
  }

  // ── 태그 삭제 ─────────────────────────────────────────────────
  // 삭제 확인 후 서버에서 태그를 삭제합니다.
  // 태그가 삭제되면 해당 태그가 붙은 모든 사진에서 자동으로 제거됩니다.
  const handleDeleteTag = async (id) => {
    if (!confirm('태그를 삭제하면 해당 태그가 모든 사진에서 제거됩니다. 삭제할까요?')) return
    setTagLoading(true)
    try {
      await adminDeleteTag(id, adminKey)
      setTags(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      alert(err.response?.data?.detail || '삭제 실패')
    } finally {
      setTagLoading(false)
    }
  }

  // ── 관리자 로그인 ─────────────────────────────────────────────
  // 아이디/비밀번호를 서버에 전송하고 성공 시 admin_token을 받아 저장합니다.
  // 이후 모든 관리자 API 요청에 이 토큰을 사용합니다.
  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    try {
      const data = await adminLogin(username, password)
      loginAdmin(data.admin_token)
    } catch (err) {
      const status = err.response?.status
      setLoginError(status === 401 || status === 403 ? '아이디 또는 비밀번호가 틀렸습니다' : '연결 오류')
    } finally {
      setLoginLoading(false)
    }
  }

  // ── 삭제 요청 처리 ────────────────────────────────────────────
  // approve: 사진을 실제로 삭제 (파일 + DB 모두 제거)
  // reject:  삭제 요청을 취소하고 사진을 다시 정상 상태로 복원
  const doPhotoAction = async (id, action) => {
    setActionLoading(id + action)
    try {
      await handlePhotoAction(id, action, adminKey)
      setPendingPhotos(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      alert(err.response?.data?.detail || 'Action failed')
    } finally {
      setActionLoading(null)
    }
  }

  const doBulkAction = async (action) => {
    const label = action === 'approve' ? '삭제' : '복원'
    if (!confirm(`삭제 요청 ${pendingPhotos.length}건을 모두 ${label}할까요?`)) return
    setActionLoading('bulk')
    try {
      await Promise.all(pendingPhotos.map(p => handlePhotoAction(p.id, action, adminKey)))
      setPendingPhotos([])
    } catch (err) {
      alert(err.response?.data?.detail || '일괄 처리 실패')
    } finally {
      setActionLoading(null)
    }
  }

  // ── 신규 회원 승인/거절 ───────────────────────────────────────
  // approve: 회원을 승인해서 로그인 가능 상태로 변경
  // reject:  회원을 거절해서 로그인 불가 상태로 변경
  const doUserAction = async (id, action) => {
    setActionLoading(id + action)
    try {
      await handleUserAction(id, action, adminKey)
      setPendingUsers(prev => prev.filter(u => u.id !== id))
    } catch (err) {
      alert(err.response?.data?.detail || 'Action failed')
    } finally {
      setActionLoading(null)
    }
  }

  // ISO 날짜 문자열을 YYYY.MM.DD 형식으로 변환하는 함수
  const dateLabel = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}.${mm}.${dd}`
  }

  if (!adminKey) {
    return (
      <div className="page">
        <div className="login-wrap">
          <form className="login-card" onSubmit={handleLogin}>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ alignSelf: 'flex-start', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
              onClick={() => navigate('/')}
            >
              ← 뒤로가기
            </button>
            <h2>관리자 로그인</h2>
            <input
              type="text"
              placeholder="아이디"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
            />
            <input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            {loginError && <span className="error-msg">{loginError}</span>}
            <button
              className="btn btn-primary"
              type="submit"
              disabled={loginLoading || !username || !password}
            >
              {loginLoading ? '로그인 중…' : '로그인'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <header>
        <h1>관리자</h1>
        <button className="btn btn-ghost" onClick={logoutAdmin}>로그아웃</button>
      </header>

      <div className="admin-tabs">
        <button
          className={`admin-tab${activeTab === 'users' ? ' active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          회원 승인 대기 {pendingUsers.length > 0 && `(${pendingUsers.length})`}
        </button>
        <button
          className={`admin-tab${activeTab === 'photos' ? ' active' : ''}`}
          onClick={() => setActiveTab('photos')}
        >
          삭제 요청 {pendingPhotos.length > 0 && `(${pendingPhotos.length})`}
        </button>
        <button
          className={`admin-tab${activeTab === 'tags' ? ' active' : ''}`}
          onClick={() => setActiveTab('tags')}
        >
          태그 관리
        </button>
        <button
          className={`admin-tab${activeTab === 'titles' ? ' active' : ''}`}
          onClick={() => setActiveTab('titles')}
        >
          회원 호칭
        </button>
      </div>

      {dataLoading && <p className="empty-msg">불러오는 중…</p>}

      {!dataLoading && activeTab === 'users' && (
        pendingUsers.length === 0 ? (
          <p className="empty-msg">대기 중인 회원이 없습니다.</p>
        ) : (
          <div className="pending-list">
            {pendingUsers.map(u => (
              <div key={u.id} className="pending-user-item">
                <div className="pending-user-info">
                  <div className="user-name">{u.name}</div>
                  <div className="user-phone">{u.phone_number}</div>
                  <div className="user-date">{dateLabel(u.created_at ?? u.registered_at)}</div>
                </div>
                <div className="pending-item-actions">
                  <button
                    className="btn btn-success"
                    onClick={() => doUserAction(u.id, 'approve')}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === u.id + 'approve' ? '…' : '승인'}
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => doUserAction(u.id, 'reject')}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === u.id + 'reject' ? '…' : '거절'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {!dataLoading && activeTab === 'titles' && (
        <div className="tag-admin-wrap">
          {allUsers.length === 0 ? (
            <p className="empty-msg">승인된 회원이 없습니다.</p>
          ) : (
            <div className="tag-admin-list">
              {allUsers.map(u => (
                <div key={u.id} className="tag-admin-item">
                  {editingTitleId === u.id ? (
                    <>
                      <span style={{ fontWeight: 500, minWidth: '5rem' }}>{u.name}</span>
                      <input
                        className="auth-input"
                        placeholder="호칭 입력 (예: 삼촌)"
                        value={editingTitleValue}
                        onChange={e => setEditingTitleValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSaveTitle(u.id)
                          if (e.key === 'Escape') { setEditingTitleId(null); setEditingTitleValue('') }
                        }}
                        autoFocus
                        style={{ flex: 1 }}
                      />
                      <button className="btn btn-primary" onClick={() => handleSaveTitle(u.id)} disabled={titleLoading} style={{ padding: '0.3rem 0.7rem' }}>저장</button>
                      <button className="btn btn-ghost" onClick={() => { setEditingTitleId(null); setEditingTitleValue('') }} style={{ padding: '0.3rem 0.7rem' }}>취소</button>
                    </>
                  ) : (
                    <>
                      <span className="tag-admin-name">
                        {u.name}{u.title ? <span style={{ color: '#DC2626', marginLeft: '0.25rem' }}>({u.title})</span> : ''}
                      </span>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          className="btn btn-ghost"
                          onClick={() => { setEditingTitleId(u.id); setEditingTitleValue(u.title || '') }}
                          style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}
                        >
                          {u.title ? '수정' : '호칭 지정'}
                        </button>
                        {u.title && (
                          <button
                            className="btn btn-danger"
                            onClick={() => handleRemoveTitle(u.id)}
                            disabled={titleLoading}
                            style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!dataLoading && activeTab === 'tags' && (
        <div className="tag-admin-wrap">
          {/* 태그 추가 */}
          <form className="tag-admin-form" onSubmit={handleCreateTag}>
            <input
              className="auth-input"
              placeholder="새 태그 이름 (10자 이하)"
              value={newTagName}
              onChange={e => {
                setNewTagName(e.target.value)
                setNewTagError(e.target.value.length > 10 ? '태그는 10글자를 초과할 수 없습니다' : '')
              }}
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-primary"
              type="submit"
              disabled={tagLoading || !newTagName.trim() || newTagName.length > 10}
            >
              추가
            </button>
          </form>
          {newTagError && <span className="error-msg" style={{ fontSize: '0.8rem' }}>{newTagError}</span>}

          {/* 태그 목록 */}
          {tags.length === 0 ? (
            <p className="empty-msg">태그가 없습니다.</p>
          ) : (
            <div className="tag-admin-list">
              {tags.map(tag => (
                <div key={tag.id} className="tag-admin-item">
                  {editingTagId === tag.id ? (
                    <>
                      <input
                        className="auth-input"
                        value={editingTagName}
                        onChange={e => {
                          setEditingTagName(e.target.value)
                          setEditingTagError(e.target.value.length > 10 ? '태그는 10글자를 초과할 수 없습니다' : '')
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleUpdateTag(tag.id)
                          if (e.key === 'Escape') { setEditingTagId(null); setEditingTagError('') }
                        }}
                        autoFocus
                        style={{ flex: 1 }}
                      />
                      {editingTagError && <span className="error-msg" style={{ fontSize: '0.75rem' }}>{editingTagError}</span>}
                      <button
                        className="btn btn-primary"
                        onClick={() => handleUpdateTag(tag.id)}
                        disabled={tagLoading || !editingTagName.trim() || editingTagName.length > 10}
                        style={{ padding: '0.3rem 0.7rem' }}
                      >
                        저장
                      </button>
                      <button
                        className="btn btn-ghost"
                        onClick={() => { setEditingTagId(null); setEditingTagError('') }}
                        style={{ padding: '0.3rem 0.7rem' }}
                      >
                        취소
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="tag-admin-name">#{tag.name}</span>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          className="btn btn-ghost"
                          onClick={() => { setEditingTagId(tag.id); setEditingTagName(tag.name); setEditingTagError('') }}
                          style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}
                        >
                          수정
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => handleDeleteTag(tag.id)}
                          disabled={tagLoading}
                          style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}
                        >
                          삭제
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!dataLoading && activeTab === 'photos' && (
        pendingPhotos.length === 0 ? (
          <p className="empty-msg">삭제 요청이 없습니다.</p>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button
                className="btn btn-success"
                onClick={() => doBulkAction('reject')}
                disabled={!!actionLoading}
              >
                {actionLoading === 'bulk' ? '…' : `전체 복원 (${pendingPhotos.length})`}
              </button>
              <button
                className="btn btn-danger"
                onClick={() => doBulkAction('approve')}
                disabled={!!actionLoading}
              >
                {actionLoading === 'bulk' ? '…' : `전체 삭제 (${pendingPhotos.length})`}
              </button>
            </div>
          <div className="pending-list">
            {pendingPhotos.map(photo => (
              <div key={photo.id} className="pending-item">
                {photo.thumbnail_filename ? (
                  <img src={photo.thumbnail_url} alt={photo.original_filename} />
                ) : photo.media_type === 'video' ? (
                  <video src={photo.url} muted preload="metadata" />
                ) : (
                  <img src={photo.url} alt={photo.original_filename} />
                )}
                <div className="pending-item-info">
                  <div className="name" title={photo.original_filename}>{photo.original_filename}</div>
                  <div className="date">{dateLabel(photo.date_taken)}</div>
                </div>
                <div className="pending-item-actions">
                  <button
                    className="btn btn-success"
                    onClick={() => doPhotoAction(photo.id, 'reject')}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === photo.id + 'reject' ? '…' : '복원'}
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => doPhotoAction(photo.id, 'approve')}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === photo.id + 'approve' ? '…' : '삭제'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          </>
        )
      )}
    </div>
  )
}
