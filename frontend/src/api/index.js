// =====================================================================
// api/index.js — 백엔드 서버와 통신하는 모든 함수 모음
// axios 라이브러리를 사용해서 백엔드 API에 요청을 보냅니다.
// 모든 요청은 /api 경로로 시작하며, Vite 개발 서버가 백엔드로 전달합니다.
// =====================================================================

import axios from 'axios'

// axios 기본 설정 — 모든 요청의 주소 앞에 '/api'를 붙임
const api = axios.create({ baseURL: '/api' })

// 모든 API 응답에서 401이 오면 auth:unauthorized 이벤트 발생
// AuthContext가 이 이벤트를 받아 자동 로그아웃 처리함
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new Event('auth:unauthorized'))
    }
    return Promise.reject(error)
  }
)


// ── 인증 (Auth) ────────────────────────────────────────────────

// 회원가입 — 이름과 전화번호를 서버에 전송, 관리자 승인 대기 상태가 됨
export const register = (name, phoneNumber) =>
  api.post('/auth/register', { name, phone_number: phoneNumber }).then(r => r.data)

// 로그인 — 전화번호로 로그인, 성공 시 토큰과 사용자 정보 반환
export const login = (phoneNumber) =>
  api.post('/auth/login', { phone_number: phoneNumber }).then(r => r.data)

// 내 정보 가져오기 — 현재 로그인된 사용자의 정보 조회
export const getMe = (token) =>
  api.get('/auth/me', { headers: { 'x-user-token': token } }).then(r => r.data)


// ── 폴더 (Folders) ────────────────────────────────────────────

// 폴더 목록 가져오기
export const getFolders = (token) =>
  api.get('/folders', { headers: { 'x-user-token': token } }).then(r => r.data)

// 새 폴더 만들기
export const createFolder = (name, token) =>
  api.post('/folders', { name }, { headers: { 'x-user-token': token } }).then(r => r.data)

// 폴더 삭제하기
export const deleteFolder = (id, token) =>
  api.delete(`/folders/${id}`, { headers: { 'x-user-token': token } }).then(r => r.data)


// ── 사진 (Photos) ─────────────────────────────────────────────

// 사진 목록 가져오기 (서버사이드 페이지네이션)
// tagId: 태그 필터, mediaType: "image"|"video"|null, likedOnly: 좋아요한 것만
export const getPhotos = (token, tagId = null, page = 1, limit = 15, mediaType = null, likedOnly = false) => {
  const params = { page, limit }
  if (tagId) params.tag_id = tagId
  if (mediaType) params.media_type = mediaType
  if (likedOnly) params.liked_only = true
  return api.get('/photos', {
    params,
    headers: { 'x-user-token': token },
  }).then(r => r.data)
}

// 사진/영상 업로드 — FormData로 파일을 서버에 전송
export const uploadPhoto = (file, token, folderId = null) => {
  const form = new FormData()
  form.append('file', file)
  if (folderId) form.append('folder_id', folderId)
  return api.post('/photos/upload', form, {
    headers: { 'x-user-token': token },
  }).then(r => r.data)
}

// 사진 삭제 요청 — 관리자가 최종 승인해야 실제로 삭제됨
export const requestDeletion = (id, token) =>
  api.post(`/photos/${id}/request-deletion`, null, {
    headers: { 'x-user-token': token },
  }).then(r => r.data)

// 사진 삭제 요청 취소 — 삭제 대기 상태를 다시 active로 되돌림
export const cancelDeletion = (id, token) =>
  api.post(`/photos/${id}/cancel-deletion`, null, {
    headers: { 'x-user-token': token },
  }).then(r => r.data)


// ── 댓글 (Comments) ───────────────────────────────────────────

// 특정 사진의 댓글 목록 가져오기
export const getComments = (photoId, token) =>
  api.get(`/photos/${photoId}/comments`, {
    headers: { 'x-user-token': token },
  }).then(r => r.data)

// 댓글 작성
export const addComment = (photoId, content, token) =>
  api.post(`/photos/${photoId}/comments`, { content }, {
    headers: { 'x-user-token': token },
  }).then(r => r.data)

// 댓글 삭제 — 본인 댓글만 삭제 가능
export const deleteComment = (id, token) =>
  api.delete(`/comments/${id}`, {
    headers: { 'x-user-token': token },
  }).then(r => r.data)


// ── 좋아요 (Likes) ────────────────────────────────────────────

// 좋아요 토글 — 누르면 좋아요, 다시 누르면 취소
export const toggleLike = (photoId, token) =>
  api.post(`/photos/${photoId}/like`, null, {
    headers: { 'x-user-token': token },
  }).then(r => r.data)

// 특정 사진의 좋아요 수 및 내가 눌렀는지 여부 조회
export const getLikes = (photoId, token) =>
  api.get(`/photos/${photoId}/likes`, {
    headers: { 'x-user-token': token },
  }).then(r => r.data)


// ── 관리자 (Admin) ────────────────────────────────────────────

// 관리자 로그인 — admin/0711
export const adminLogin = (username, password) =>
  api.post('/admin/login', { username, password }).then(r => r.data)

// 삭제 요청 대기 중인 사진 목록 가져오기
export const getPending = (adminKey) =>
  api.get('/admin/pending', {
    headers: { 'x-admin-key': adminKey },
  }).then(r => r.data)

// 삭제 요청 처리 — approve(삭제 승인) 또는 reject(복원)
export const handlePhotoAction = (id, action, adminKey) =>
  api.post(`/admin/photos/${id}/action`, null, {
    params: { action },
    headers: { 'x-admin-key': adminKey },
  }).then(r => r.data)

// 하위 호환 이름 유지
export const handleAction = handlePhotoAction

// 승인 대기 중인 신규 회원 목록 가져오기
export const getPendingUsers = (adminKey) =>
  api.get('/admin/users/pending', {
    headers: { 'x-admin-key': adminKey },
  }).then(r => r.data)

// 신규 회원 처리 — approve(승인) 또는 reject(거절)
export const handleUserAction = (id, action, adminKey) =>
  api.post(`/admin/users/${id}/action`, null, {
    params: { action },
    headers: { 'x-admin-key': adminKey },
  }).then(r => r.data)


// ── 태그 (Tags) ───────────────────────────────────────────────

// 전체 태그 목록 가져오기 (일반 사용자용)
export const getTags = (token) =>
  api.get('/tags', { headers: { 'x-user-token': token } }).then(r => r.data)

// 새 태그 만들기 (일반 사용자용, 갤러리 탭에서 사용)
export const createTag = (name, token) =>
  api.post('/tags', { name }, { headers: { 'x-user-token': token } }).then(r => r.data)

// 특정 사진의 태그 수정 — 기존 태그 ID 목록과 새 태그 이름 목록을 전달
export const updatePhotoTags = (photoId, tagIds, newTags, token) =>
  api.put(`/photos/${photoId}/tags`, { tag_ids: tagIds, new_tags: newTags }, {
    headers: { 'x-user-token': token },
  }).then(r => r.data)

// 사진 상세 정보 가져오기 (댓글, 좋아요, 태그 포함)
export const getPhotoDetail = (photoId, token) =>
  api.get(`/photos/${photoId}/detail`, { headers: { 'x-user-token': token } }).then(r => r.data)


// ── 관리자 회원 관리 ──────────────────────────────────────────

// 승인된 전체 회원 목록 가져오기 (호칭 관리용)
export const adminGetAllUsers = (adminKey) =>
  api.get('/admin/users', { headers: { 'x-admin-key': adminKey } }).then(r => r.data)

// 특정 회원의 호칭 설정 — 예: "삼촌", "이모" 등 (빈 문자열이면 호칭 제거)
export const adminSetUserTitle = (id, title, adminKey) =>
  api.put(`/admin/users/${id}/title`, { title }, { headers: { 'x-admin-key': adminKey } }).then(r => r.data)


// ── 관리자 태그 관리 ──────────────────────────────────────────

// 전체 태그 목록 가져오기 (관리자용)
export const adminGetTags = (adminKey) =>
  api.get('/admin/tags', { headers: { 'x-admin-key': adminKey } }).then(r => r.data)

// 새 태그 만들기 (관리자용)
export const adminCreateTag = (name, adminKey) =>
  api.post('/admin/tags', { name }, { headers: { 'x-admin-key': adminKey } }).then(r => r.data)

// 태그 이름 수정 (관리자용)
export const adminUpdateTag = (id, name, adminKey) =>
  api.put(`/admin/tags/${id}`, { name }, { headers: { 'x-admin-key': adminKey } }).then(r => r.data)

// 태그 삭제 — 해당 태그가 붙은 모든 사진에서도 자동 제거 (관리자용)
export const adminDeleteTag = (id, adminKey) =>
  api.delete(`/admin/tags/${id}`, { headers: { 'x-admin-key': adminKey } }).then(r => r.data)


// ── 편지 (Letters) ────────────────────────────────────────────

export const getLetters = (token, page = 1, limit = 16) =>
  api.get('/letters', { params: { page, limit }, headers: { 'x-user-token': token } }).then(r => r.data)

export const createLetter = (title, content, token) =>
  api.post('/letters', { title, content }, { headers: { 'x-user-token': token } }).then(r => r.data)

export const getLetterDetail = (id, token) =>
  api.get(`/letters/${id}`, { headers: { 'x-user-token': token } }).then(r => r.data)

export const updateLetter = (id, title, content, token) =>
  api.put(`/letters/${id}`, { title, content }, { headers: { 'x-user-token': token } }).then(r => r.data)

export const deleteLetter = (id, token) =>
  api.delete(`/letters/${id}`, { headers: { 'x-user-token': token } }).then(r => r.data)
