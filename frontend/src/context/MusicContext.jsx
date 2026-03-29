// =====================================================================
// MusicContext.jsx — 음악 재생 상태 전역 공유
// App.jsx의 MusicPlayer와 Gallery.jsx의 로고 버튼이 같은 상태를 공유합니다.
// =====================================================================

import { createContext, useContext, useState, useEffect, useRef } from 'react'

const MusicContext = createContext(null)

export function MusicProvider({ children }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = 0.4
    const onCanPlay = () => setReady(true)
    audio.addEventListener('canplaythrough', onCanPlay, { once: true })
  }, [])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio || !ready) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.play().then(() => setPlaying(true)).catch(() => {})
    }
  }

  return (
    <MusicContext.Provider value={{ playing, ready, toggle }}>
      <audio ref={audioRef} src="/music.mp3" loop />
      {children}
    </MusicContext.Provider>
  )
}

export const useMusic = () => useContext(MusicContext)
