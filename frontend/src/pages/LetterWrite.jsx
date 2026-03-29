// =====================================================================
// LetterWrite.jsx — 편지 쓰기 페이지
// =====================================================================

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createLetter } from '../api'

export default function LetterWrite() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) { setError('제목을 입력해주세요'); return }
    if (!content.trim()) { setError('내용을 입력해주세요'); return }
    setSubmitting(true)
    setError('')
    try {
      await createLetter(title.trim(), content.trim(), user.token)
      navigate('/gallery/letter')
    } catch (err) {
      setError(err.response?.data?.detail || '편지 전송에 실패했습니다')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="letter-write-page">
      <button
        className="detail-back"
        onClick={() => {
          sessionStorage.setItem('galleryRestoreState', 'true')
          navigate(-1)
        }}
      >
        ← 뒤로가기
      </button>

      <form className="letter-paper" onSubmit={handleSubmit}>
        <div className="letter-paper-header">
          <span className="letter-paper-to">To. 하준이</span>
          <span className="letter-paper-from">From. {user?.name}</span>
        </div>
        <input
          className="letter-title-input"
          type="text"
          placeholder="제목"
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={100}
        />
        <div className="letter-paper-divider" />
        <textarea
          className="letter-content-input"
          placeholder="마음을 담아 편지를 써주세요…"
          value={content}
          onChange={e => setContent(e.target.value)}
          maxLength={3000}
          rows={16}
        />
        {error && <span className="error-msg">{error}</span>}
        <div className="letter-paper-footer">
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? '전송 중…' : '편지 보내기'}
          </button>
        </div>
      </form>
    </div>
  )
}
