'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Sentence {
  id: string
  text: string
  translation: string | null
  startTime: number
  endTime: number
  order: number
  userNotes?: {
    words: string
    notes: string
  }
}

interface TrainingItem {
  id: string
  title: string
  audioUrl: string
  sentences: Sentence[]
}

export default function TrainingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [item, setItem] = useState<TrainingItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(-1)
  const [showTranslations, setShowTranslations] = useState(true)
  const [repeatMode, setRepeatMode] = useState<number | null>(null)
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())
  const [userNotes, setUserNotes] = useState<Record<string, { words: string; notes: string }>>({})

  const audioRef = useRef<HTMLAudioElement>(null)
  const [audioLoaded, setAudioLoaded] = useState(false)

  useEffect(() => {
    fetchTrainingItem()
  }, [params.id])

  useEffect(() => {
    if (item) {
      fetchUserNotes()
    }
  }, [item])

  const fetchTrainingItem = async () => {
    try {
      const response = await fetch(`/api/training-items/${params.id}`)
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      setItem(data)
    } catch (error) {
      console.error('Error fetching training item:', error)
      alert('加载失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchUserNotes = async () => {
    if (!item) return
    const notes: Record<string, { words: string; notes: string }> = {}
    for (const sentence of item.sentences) {
      try {
        const response = await fetch(
          `/api/user-notes?sentenceId=${sentence.id}&userId=default`
        )
        const data = await response.json()
        notes[sentence.id] = {
          words: data.words || '',
          notes: data.notes || ''
        }
      } catch (error) {
        console.error('Error fetching user notes:', error)
      }
    }
    setUserNotes(notes)
  }

  const handleTimeUpdate = () => {
    if (!audioRef.current || !item) return
    const time = audioRef.current.currentTime

    if (repeatMode !== null && item.sentences[repeatMode]) {
      const sentence = item.sentences[repeatMode]
      if (time >= sentence.endTime) {
        audioRef.current.currentTime = sentence.startTime
      }
    }

    setCurrentTime(time)

    const index = item.sentences.findIndex(
      (s) => time >= s.startTime && time < s.endTime
    )
    setCurrentSentenceIndex(index)
  }

  const handleSentenceClick = (sentence: Sentence) => {
    if (audioRef.current) {
      audioRef.current.currentTime = sentence.startTime
      audioRef.current.play()
    }
  }

  const handleRepeatClick = (index: number) => {
    if (repeatMode === index) {
      setRepeatMode(null)
    } else {
      setRepeatMode(index)
      if (audioRef.current && item) {
        const sentence = item.sentences[index]
        audioRef.current.currentTime = sentence.startTime
        audioRef.current.play()
      }
    }
  }

  const toggleNotes = (sentenceId: string) => {
    const newExpanded = new Set(expandedNotes)
    if (newExpanded.has(sentenceId)) {
      newExpanded.delete(sentenceId)
    } else {
      newExpanded.add(sentenceId)
    }
    setExpandedNotes(newExpanded)
  }

  const handleNotesChange = async (sentenceId: string, field: 'words' | 'notes', value: string) => {
    const updated = {
      ...userNotes[sentenceId],
      [field]: value
    }
    setUserNotes({
      ...userNotes,
      [sentenceId]: updated
    })

    try {
      await fetch('/api/user-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentenceId,
          words: updated.words || '',
          notes: updated.notes || '',
          userId: 'default'
        })
      })
    } catch (error) {
      console.error('Error saving user notes:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-cyan-400 font-mono text-xl animate-pulse">[ 加载中... ]</div>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-400 font-mono text-xl">[ 未找到训练条目 ]</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <Link
              href="/"
              className="text-gray-400 hover:text-gray-300 mb-4 inline-block font-mono text-sm transition-colors"
            >
              ← 返回列表
            </Link>
            <h1 className="text-4xl font-bold mb-2 font-mono" style={{ 
              color: 'rgba(232, 244, 255, 0.7)',
              textShadow: '0 0 5px rgba(232, 244, 255, 0.3), 0 0 10px rgba(232, 244, 255, 0.2)',
              letterSpacing: '0.1em',
              fontWeight: 300
            }}>
              {item.title}
            </h1>
            <p className="text-gray-500 text-sm font-mono opacity-70">[ 训练模式 ]</p>
          </div>

          {/* 音频播放器 */}
          <div className="p-6 mb-6" style={{
            background: 'rgba(232, 244, 255, 0.02)',
            border: '1px solid rgba(232, 244, 255, 0.1)',
            backdropFilter: 'blur(4px)'
          }}>
            <audio
              ref={audioRef}
              src={item.audioUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedData={() => setAudioLoaded(true)}
              controls
              className="w-full"
            />
            {!audioLoaded && (
              <p className="text-sm text-gray-400 mt-2 font-mono">[ 加载音频中... ]</p>
            )}
          </div>

          {/* 控制选项 */}
          <div className="p-4 mb-6 flex items-center gap-4" style={{
            background: 'rgba(232, 244, 255, 0.02)',
            border: '1px solid rgba(232, 244, 255, 0.1)',
            backdropFilter: 'blur(4px)'
          }}>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showTranslations}
                onChange={(e) => setShowTranslations(e.target.checked)}
                className="w-5 h-5 accent-gray-400"
              />
              <span className="text-gray-300 font-mono text-sm">显示翻译</span>
            </label>
          </div>

          {/* 句子列表 */}
          <div className="space-y-6">
            {item.sentences.map((sentence, index) => {
              const isActive = currentSentenceIndex === index
              const isRepeating = repeatMode === index
              const isNotesExpanded = expandedNotes.has(sentence.id)
              const notes = userNotes[sentence.id] || { words: '', notes: '' }

              return (
                <div
                  key={sentence.id}
                  className="p-6 transition-all"
                  style={isActive ? {
                    background: 'rgba(232, 244, 255, 0.05)',
                    border: '1px solid rgba(232, 244, 255, 0.2)',
                    boxShadow: '0 0 15px rgba(232, 244, 255, 0.15)',
                    backdropFilter: 'blur(4px)'
                  } : {
                    background: 'rgba(232, 244, 255, 0.02)',
                    border: '1px solid rgba(232, 244, 255, 0.1)',
                    backdropFilter: 'blur(4px)'
                  }}
                >
                  {/* 句子文本 */}
                  <div className="flex items-start gap-4 mb-4">
                    <button
                      onClick={() => handleSentenceClick(sentence)}
                      className={`flex-1 text-left p-4 font-mono transition-all ${
                        isActive
                          ? 'text-gray-100 bg-gray-700/30'
                          : 'text-gray-300 hover:text-gray-100 hover:bg-gray-700/20'
                      }`}
                    >
                      <p className="text-lg font-bold">{sentence.text}</p>
                    </button>
                    <button
                      onClick={() => handleRepeatClick(index)}
                      className={`px-4 py-2 font-mono text-sm transition-all border ${
                        isRepeating
                          ? 'bg-red-500/20 text-red-300 border-red-400/30'
                          : 'border-gray-500/30 text-gray-300 hover:text-gray-200 hover:border-gray-400/40 bg-gray-800/20 hover:bg-gray-800/30 backdrop-blur-sm'
                      }`}
                      title="单句重复播放"
                    >
                      🔁
                    </button>
                  </div>

                  {/* 翻译 */}
                  {showTranslations && sentence.translation && (
                    <div className="mb-4 pl-4 border-l-2 border-gray-500/50">
                      <p className="text-gray-300 font-mono">{sentence.translation}</p>
                    </div>
                  )}

                  {/* 时间信息 */}
                  <div className="text-xs text-gray-500 mb-4 font-mono">
                    [{sentence.startTime.toFixed(2)}s - {sentence.endTime.toFixed(2)}s]
                  </div>

                  {/* 用户笔记 */}
                  <div className="border-t border-gray-700/20 pt-4 mt-4">
                    <button
                      onClick={() => toggleNotes(sentence.id)}
                      className="w-full text-left text-sm text-gray-400 hover:text-gray-300 flex items-center justify-between font-mono transition-colors"
                    >
                      <span>📝 [ 生词和注释 ]</span>
                      <span>{isNotesExpanded ? '▼' : '▶'}</span>
                    </button>

                    {isNotesExpanded && (
                      <div className="mt-4 space-y-4">
                        <div>
                          <label className="block text-gray-300 font-mono text-sm mb-2 uppercase tracking-wider">
                            生词
                          </label>
                          <textarea
                            value={notes.words}
                            onChange={(e) =>
                              handleNotesChange(sentence.id, 'words', e.target.value)
                            }
                            placeholder="记录生词..."
                            className="cyber-input w-full font-mono text-sm"
                            rows={2}
                          />
                        </div>
                        <div>
                          <label className="block text-gray-300 font-mono text-sm mb-2 uppercase tracking-wider">
                            注释
                          </label>
                          <textarea
                            value={notes.notes}
                            onChange={(e) =>
                              handleNotesChange(sentence.id, 'notes', e.target.value)
                            }
                            placeholder="添加注释..."
                            className="cyber-input w-full font-mono text-sm"
                            rows={3}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
