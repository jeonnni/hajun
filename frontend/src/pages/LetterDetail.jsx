// =====================================================================
// LetterDetail.jsx — 편지 상세 페이지
// =====================================================================

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getLetterDetail, updateLetter, deleteLetter } from '../api'

export default function LetterDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [letter, setLetter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!user) { navigate('/'); return }
    getLetterDetail(id, user.token)
      .then(setLetter)
      .catch(() => navigate('/gallery'))
      .finally(() => setLoading(false))
  }, [id, authLoading, user])

  const handleDelete = async () => {
    if (!confirm('이 편지를 삭제하시겠습니까?')) return
    await deleteLetter(id, user.token)
    navigate(-1)
  }

  const handleEditStart = () => {
    setEditTitle(letter.title)
    setEditContent(letter.content)
    setEditError('')
    setEditing(true)
  }

  const handleEditSave = async () => {
    if (!editTitle.trim()) { setEditError('제목을 입력해주세요'); return }
    if (!editContent.trim()) { setEditError('내용을 입력해주세요'); return }
    setSaving(true)
    setEditError('')
    try {
      const updated = await updateLetter(id, editTitle.trim(), editContent.trim(), user.token)
      setLetter(updated)
      setEditing(false)
    } catch (err) {
      setEditError(err.response?.data?.detail || '수정에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  const dateLabel = (iso) => {
    const d = new Date(iso)
    return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`
  }

  if (loading) return <div className="detail-loading">로딩 중…</div>
  if (!letter) return null

  return (
    <div className="letter-write-page">
      <button className="detail-back" onClick={() => navigate(-1)}>
        ← 뒤로가기
      </button>

      {editing ? (
        <div className="letter-paper">
          <div className="letter-paper-header">
            <span className="letter-paper-to">To. 하준이</span>
            <span className="letter-paper-from">From. {letter.user_name}</span>
          </div>
          <input
            className="letter-title-input"
            type="text"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            maxLength={100}
          />
          <div className="letter-paper-divider" />
          <textarea
            className="letter-content-input"
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            maxLength={3000}
            rows={16}
          />
          {editError && <span className="error-msg">{editError}</span>}
          <div className="letter-paper-footer">
            <button className="btn btn-primary" onClick={handleEditSave} disabled={saving}>
              {saving ? '저장 중…' : '저장'}
            </button>
            <button className="btn btn-ghost" onClick={() => setEditing(false)}
              style={{ marginLeft: '0.5rem' }}>
              취소
            </button>
          </div>
        </div>
      ) : (
        <div className="letter-paper letter-paper-readonly">
          <div className="letter-paper-header">
            <span className="letter-paper-to">To. 하준이</span>
            <span className="letter-paper-from">From. {letter.user_name}</span>
          </div>
          <div className="letter-title-readonly">{letter.title}</div>
          <div className="letter-paper-divider" />
          <div className="letter-content-readonly">{letter.content}</div>
          <div className="letter-paper-footer">
            <span className="letter-date">{dateLabel(letter.created_at)}</span>
            {letter.user_id === user.id && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-ghost" onClick={handleEditStart}
                  style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}>
                  수정
                </button>
                <button className="btn btn-ghost" onClick={handleDelete}
                  style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}>
                  삭제
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
