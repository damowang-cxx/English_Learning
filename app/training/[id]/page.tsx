'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslation } from '@/contexts/TranslationContext'
import { getAudioSrc, withBasePath } from '@/lib/base-path'

interface Sentence {
  id: string
  text: string
  translation: string | null
  startTime: number
  endTime: number
  order: number
}

interface EditSentence {
  text: string
  translation: string
  startTime: number
  endTime: number
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
  const { showTranslations, setShowTranslations } = useTranslation()
  const [repeatMode, setRepeatMode] = useState<number | null>(null)
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())
  const [userNotes, setUserNotes] = useState<Record<string, { words: string }>>({})

  const audioRef = useRef<HTMLAudioElement>(null)
  const [audioLoaded, setAudioLoaded] = useState(false)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editAudioFile, setEditAudioFile] = useState<File | null>(null)
  const [editSentences, setEditSentences] = useState<EditSentence[]>([])
  const [editCurrentSentence, setEditCurrentSentence] = useState<EditSentence>({
    text: '',
    translation: '',
    startTime: 0,
    endTime: 0
  })
  const [isUpdating, setIsUpdating] = useState(false)
  const [editingSentenceIndex, setEditingSentenceIndex] = useState<number | null>(null)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null)
  const [savingNotes, setSavingNotes] = useState<Record<string, boolean>>({})
  const sentenceRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchTrainingItem()
  }, [params.id])

  useEffect(() => {
    if (item) {
      fetchUserNotes()
    }
  }, [item])

  // 全屏模式下隐藏仪表盘
  useEffect(() => {
    const cockpitPanel = document.querySelector('.cockpit-panel') as HTMLElement
    if (cockpitPanel) {
      if (isFullscreen) {
        cockpitPanel.style.display = 'none'
      } else {
        cockpitPanel.style.display = ''
      }
    }
    return () => {
      if (cockpitPanel) {
        cockpitPanel.style.display = ''
      }
    }
  }, [isFullscreen])

  // 禁用 body 滚动条，确保只有 HUD 内部有滚动
  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    const originalHtmlOverflow = document.documentElement.style.overflow
    
    // 禁用 body 和 html 的滚动
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    
    return () => {
      // 恢复原始样式
      document.body.style.overflow = originalOverflow
      document.documentElement.style.overflow = originalHtmlOverflow
    }
  }, [])

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // 如果正在输入，不处理快捷键
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key) {
        case ' ':
          e.preventDefault()
          handlePlayPause()
          break
        case 'Escape':
          if (isEditing) {
            setIsEditing(false)
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isPlaying, duration, isEditing])

  // 播放速度控制
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate
    }
  }, [playbackRate])

  // 自动滚动到当前播放的句子
  useEffect(() => {
    if (currentSentenceIndex >= 0 && sentenceRefs.current[currentSentenceIndex] && contentRef.current) {
      const sentenceElement = sentenceRefs.current[currentSentenceIndex]
      const container = contentRef.current
      
      const containerRect = container.getBoundingClientRect()
      const sentenceRect = sentenceElement.getBoundingClientRect()
      
      // 如果句子不在可视区域内，滚动到句子位置
      if (sentenceRect.top < containerRect.top || sentenceRect.bottom > containerRect.bottom) {
        sentenceElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [currentSentenceIndex])

  // 通知自动消失
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  const fetchTrainingItem = async () => {
    try {
      const response = await fetch(withBasePath(`/api/training-items/${params.id}`))
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      setItem(data)
    } catch (error) {
      console.error('Error fetching training item:', error)
      setNotification({ type: 'error', message: '加载失败，请刷新页面重试' })
    } finally {
      setLoading(false)
    }
  }

  const handleEditClick = () => {
    if (!item) return
    setEditTitle(item.title)
    setEditSentences(item.sentences.map(s => ({
      text: s.text,
      translation: s.translation || '',
      startTime: s.startTime,
      endTime: s.endTime
    })))
    setEditCurrentSentence({
      text: '',
      translation: '',
      startTime: item.sentences.length > 0 ? item.sentences[item.sentences.length - 1].endTime : 0,
      endTime: item.sentences.length > 0 ? item.sentences[item.sentences.length - 1].endTime : 0
    })
    setEditAudioFile(null)
    setEditingSentenceIndex(null)
    setIsEditing(true)
  }

  const handleEditAddSentence = () => {
    if (!editCurrentSentence.text.trim()) {
      setNotification({ type: 'error', message: '请填写英语句子' })
      return
    }
    if (editCurrentSentence.startTime < 0 || editCurrentSentence.endTime <= editCurrentSentence.startTime) {
      setNotification({ type: 'error', message: '请填写有效的开始时间和结束时间（结束时间必须大于开始时间）' })
      return
    }
    
    if (editingSentenceIndex !== null) {
      // 更新已存在的句子
      const updatedSentences = [...editSentences]
      updatedSentences[editingSentenceIndex] = { ...editCurrentSentence }
      setEditSentences(updatedSentences)
      setEditingSentenceIndex(null)
    } else {
      // 添加新句子
      setEditSentences([...editSentences, { ...editCurrentSentence }])
    }
    
    // 清空表单
    const lastEndTime = editSentences.length > 0 
      ? editSentences[editSentences.length - 1].endTime 
      : (editingSentenceIndex !== null && editSentences[editingSentenceIndex] 
        ? editSentences[editingSentenceIndex].endTime 
        : 0)
    setEditCurrentSentence({
      text: '',
      translation: '',
      startTime: lastEndTime,
      endTime: lastEndTime
    })
  }

  const handleEditSentence = (index: number) => {
    // 如果已经在编辑另一个句子，先取消
    if (editingSentenceIndex !== null && editingSentenceIndex !== index) {
      handleCancelEdit()
    }
    const sentence = editSentences[index]
    setEditCurrentSentence({
      text: sentence.text,
      translation: sentence.translation,
      startTime: sentence.startTime,
      endTime: sentence.endTime
    })
    setEditingSentenceIndex(index)
  }

  const handleCancelEdit = () => {
    setEditingSentenceIndex(null)
    const lastEndTime = editSentences.length > 0 
      ? editSentences[editSentences.length - 1].endTime 
      : 0
    setEditCurrentSentence({
      text: '',
      translation: '',
      startTime: lastEndTime,
      endTime: lastEndTime
    })
  }

  const handleEditRemoveSentence = (index: number) => {
    const sentence = editSentences[index]
    const confirmDelete = window.confirm(`确定要删除句子 "${sentence.text.substring(0, 30)}${sentence.text.length > 30 ? '...' : ''}" 吗？`)
    if (!confirmDelete) return

    setEditSentences(editSentences.filter((_, i) => i !== index))
    // 如果删除的是正在编辑的句子，取消编辑状态
    if (editingSentenceIndex === index) {
      handleCancelEdit()
    } else if (editingSentenceIndex !== null && editingSentenceIndex > index) {
      // 如果删除的句子在正在编辑的句子之前，需要调整编辑索引
      setEditingSentenceIndex(editingSentenceIndex - 1)
    }
    setNotification({ type: 'info', message: '句子已删除' })
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const hasUnsaved = editCurrentSentence.text.trim() && 
                       editCurrentSentence.startTime >= 0 && 
                       editCurrentSentence.endTime > editCurrentSentence.startTime
    
    let finalSentences = [...editSentences]
    
    if (hasUnsaved) {
      const shouldAdd = window.confirm('检测到未保存的句子分段，是否先添加到列表？\n\n如果选择"取消"，将只提交已保存的句子。')
      if (shouldAdd) {
        if (!editCurrentSentence.text.trim()) {
          setNotification({ type: 'error', message: '请填写英语句子' })
          return
        }
        if (editCurrentSentence.startTime < 0 || editCurrentSentence.endTime <= editCurrentSentence.startTime) {
          setNotification({ type: 'error', message: '请填写有效的开始时间和结束时间（结束时间必须大于开始时间）' })
          return
        }
        finalSentences = [...editSentences, { ...editCurrentSentence }]
      }
    }
    
    if (!editTitle || finalSentences.length === 0) {
      setNotification({ type: 'error', message: '请填写标题和至少一个句子分段' })
      return
    }

    setIsUpdating(true)
    try {
      const formData = new FormData()
      formData.append('title', editTitle)
      if (editAudioFile) {
        formData.append('audio', editAudioFile)
      }
      formData.append('sentences', JSON.stringify(finalSentences))

      const response = await fetch(withBasePath(`/api/training-items/${params.id}`), {
        method: 'PUT',
        body: formData
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Update failed:', errorText)
        throw new Error(`更新失败: ${response.status}`)
      }

      const data = await response.json()
      setItem(data)
      setIsEditing(false)
      setNotification({ type: 'success', message: '更新成功！' })
    } catch (error) {
      console.error('Update error:', error)
      setNotification({ type: 'error', message: `更新失败，请重试: ${error instanceof Error ? error.message : '未知错误'}` })
    } finally {
      setIsUpdating(false)
    }
  }

  const hasUnsavedEditSentence = editCurrentSentence.text.trim() && 
                                  editCurrentSentence.startTime >= 0 && 
                                  editCurrentSentence.endTime > editCurrentSentence.startTime

  const fetchUserNotes = async () => {
    if (!item) return
    const notes: Record<string, { words: string }> = {}
    for (const sentence of item.sentences) {
      try {
        const response = await fetch(
          withBasePath(`/api/user-notes?sentenceId=${sentence.id}&userId=default`)
        )
        const data = await response.json()
        notes[sentence.id] = {
          words: data.words || ''
        }
      } catch (error) {
        console.error('Error fetching user notes:', error)
      }
    }
    setUserNotes(notes)
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

  const handleNotesChange = async (sentenceId: string, value: string) => {
    const updated = {
      words: value
    }
    setUserNotes({
      ...userNotes,
      [sentenceId]: updated
    })

    // 显示保存状态
    setSavingNotes(prev => ({ ...prev, [sentenceId]: true }))

    try {
      await fetch(withBasePath('/api/user-notes'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentenceId,
          words: updated.words || '',
          notes: '',
          userId: 'default'
        })
      })
      // 延迟隐藏保存状态，让用户看到保存成功
      setTimeout(() => {
        setSavingNotes(prev => {
          const newState = { ...prev }
          delete newState[sentenceId]
          return newState
        })
      }, 500)
    } catch (error) {
      console.error('Error saving user notes:', error)
      setSavingNotes(prev => {
        const newState = { ...prev }
        delete newState[sentenceId]
        return newState
      })
      setNotification({ type: 'error', message: '保存词汇失败，请重试' })
    }
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

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      const newTime = parseFloat(e.target.value)
      audioRef.current.currentTime = newTime
      setCurrentTime(newTime)
    }
  }

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '00:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  const handleSentenceClick = (sentence: Sentence) => {
    if (audioRef.current) {
      audioRef.current.currentTime = sentence.startTime
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate)
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


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-cyan-400 cyber-title text-xl animate-pulse cyber-neon">[ 加载中... ]</div>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-400 cyber-title text-xl">[ 未找到训练条目 ]</div>
      </div>
    )
  }

  return (
    <div 
      data-training-page
      className={`min-h-screen relative flex items-center justify-center transition-all duration-300 ${
        isFullscreen ? 'fixed inset-0 z-[100] training-fullscreen' : ''
      }`}
      style={isFullscreen ? {} : { paddingBottom: '45vh', paddingTop: '10vh' }}
    >
        {/* HUD屏幕容器 - 赛博朋克绿色主题 */}
        <div 
          className={`mx-auto relative transition-all duration-300 ${
            isFullscreen ? 'w-[98%] h-[98vh]' : 'w-[95%] max-w-6xl'
          }`}
          style={{ zIndex: isFullscreen ? 100 : 50 }}
        >
          {/* 主HUD屏幕 - 半透明 */}
          <div className={`relative backdrop-blur-md border-2 border-green-500/50 rounded-lg overflow-hidden shadow-[0_0_40px_rgba(10,255,10,0.3),inset_0_0_30px_rgba(10,255,10,0.1)] transition-all duration-300 ${
            isFullscreen ? 'bg-black/30 h-full' : 'bg-black/40'
          }`} style={{
            boxShadow: '0 0 40px rgba(10,255,10,0.25), inset 0 0 30px rgba(10,255,10,0.1), 0 0 60px rgba(10,255,10,0.15)'
          }}>
            {/* 边框发光效果 */}
            <div className="absolute inset-0 border-2 border-green-400/20 rounded-lg pointer-events-none animate-pulse" style={{
              boxShadow: 'inset 0 0 15px rgba(10,255,10,0.2), 0 0 20px rgba(10,255,10,0.15)'
            }}></div>
            
            {/* 能量波动效果 */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(10,255,10,0.04)_40%,transparent_70%)] animate-pulse" style={{ animationDuration: '3s' }}></div>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_70%,transparent_0%,rgba(10,255,10,0.03)_30%,transparent_60%)] animate-pulse" style={{ animationDuration: '4s', animationDelay: '1s' }}></div>
            </div>

            {/* 粒子背景效果 */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(15)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-1 h-1 bg-green-400/20 rounded-full animate-pulse"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 2}s`,
                    animationDuration: `${2 + Math.random() * 2}s`,
                    boxShadow: '0 0 3px rgba(10,255,10,0.4)'
                  }}
                ></div>
              ))}
            </div>
            {/* 顶部装饰栏 - 增强版 */}
            <div className="relative border-b-2 border-green-500/50 bg-gradient-to-r from-green-900/20 via-transparent to-transparent p-4 overflow-hidden">
              {/* 背景光效 */}
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/3 via-transparent to-transparent"></div>
              
              {/* 扫描线效果 */}
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-green-500/40 to-transparent animate-shimmer"></div>
              
              {/* 装饰点 */}
              <div className="absolute top-2 left-4 w-1 h-1 bg-green-400/60 rounded-full animate-pulse" style={{ boxShadow: '0 0 3px rgba(10,255,10,0.5)' }}></div>
              <div className="absolute top-2 right-4 w-1 h-1 bg-green-400/60 rounded-full animate-pulse" style={{ boxShadow: '0 0 3px rgba(10,255,10,0.5)', animationDelay: '0.5s' }}></div>
              <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-400/70 rounded-full animate-pulse shadow-[0_0_6px_rgba(10,255,10,0.6)]"></div>
                  <h1 className="text-2xl cyber-title text-green-400 cyber-neon">
                    [ TRAINING MODULE ]
                  </h1>
                </div>
                <div className="flex items-center gap-2">
                  {/* 编辑按钮 */}
                  <button
                    onClick={handleEditClick}
                    className="text-green-400/70 hover:text-green-300 cyber-button-text text-sm transition-all px-3 py-1 border border-green-500/30 hover:border-green-500/50 hover:bg-green-500/10 rounded relative z-50 cursor-pointer flex items-center gap-2 group/btn"
                    style={{ zIndex: 100 }}
                  >
                    {/* 按钮光效 */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-500/6 to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity rounded"></div>
                    {/* 按钮扫描线 */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-500/12 to-transparent opacity-0 group-hover/btn:opacity-100 animate-shimmer transition-opacity rounded" style={{ width: '50%' }}></div>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>EDIT</span>
                  </button>
                  {/* 放大/缩小按钮 */}
                  <button
                    onClick={toggleFullscreen}
                    className="text-green-400/70 hover:text-green-300 cyber-button-text text-sm transition-all px-3 py-1 border border-green-500/30 hover:border-green-500/50 hover:bg-green-500/10 rounded relative z-50 cursor-pointer flex items-center gap-2 group/btn"
                    style={{ zIndex: 100 }}
                    title={isFullscreen ? '缩小' : '全屏'}
                  >
                    {/* 按钮光效 */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-500/6 to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity rounded"></div>
                    {/* 按钮扫描线 */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-500/12 to-transparent opacity-0 group-hover/btn:opacity-100 animate-shimmer transition-opacity rounded" style={{ width: '50%' }}></div>
                    {isFullscreen ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                        </svg>
                        <span>MINIMIZE</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                        <span>MAXIMIZE</span>
                      </>
                    )}
                  </button>
                  {/* 返回按钮 */}
                  <button
                    onClick={() => router.push('/')}
                    className="text-green-400/70 hover:text-green-300 cyber-button-text text-sm transition-all px-3 py-1 border border-green-500/30 hover:border-green-500/50 hover:bg-green-500/10 rounded relative z-50 cursor-pointer group/btn"
                    style={{ zIndex: 100 }}
                  >
                    {/* 按钮光效 */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-500/6 to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity rounded"></div>
                    {/* 按钮扫描线 */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-500/12 to-transparent opacity-0 group-hover/btn:opacity-100 animate-shimmer transition-opacity rounded" style={{ width: '50%' }}></div>
                    ← BACK
                  </button>
                </div>
              </div>
              <div className="mt-2 text-xs cyber-label text-green-500/60">
                {item.title.toUpperCase()}
              </div>
            </div>

          {/* HUD网格背景 - 增强版 */}
          <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_24%,rgba(10,255,10,.05)_25%,rgba(10,255,10,.05)_26%,transparent_27%,transparent_74%,rgba(10,255,10,.05)_75%,rgba(10,255,10,.05)_76%,transparent_77%,transparent),linear-gradient(90deg,transparent_24%,rgba(10,255,10,.05)_25%,rgba(10,255,10,.05)_26%,transparent_27%,transparent_74%,rgba(10,255,10,.05)_75%,rgba(10,255,10,.05)_76%,transparent_77%,transparent)] bg-[length:40px_40px] pointer-events-none opacity-30"></div>
          
          {/* 网格光点效果 */}
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(20)].map((_, i) => {
              const x = (i % 5) * 25 + 12.5
              const y = Math.floor(i / 5) * 20 + 10
              return (
                <div
                  key={i}
                  className="absolute w-0.5 h-0.5 bg-green-400/25 rounded-full animate-pulse"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    animationDelay: `${i * 0.2}s`,
                    animationDuration: '2s',
                    boxShadow: '0 0 2px rgba(10,255,10,0.5)'
                  }}
                ></div>
              )
            })}
          </div>

          {/* 扫描线效果 - 多层 */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(10,255,10,0.02),rgba(10,255,10,0.01),rgba(10,255,10,0.02))] bg-[length:100%_3px,4px_100%] pointer-events-none opacity-30"></div>
          
          {/* 垂直扫描线 */}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(10,255,10,0.05)_50%,transparent_100%)] bg-[length:100%_4px] pointer-events-none opacity-20 animate-scan-vertical" style={{ animationDuration: '3s' }}></div>
          
          {/* 水平扫描线 */}
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(10,255,10,0.04)_50%,transparent_100%)] bg-[length:4px_100%] pointer-events-none opacity-15 animate-shimmer" style={{ animationDuration: '4s' }}></div>

          {/* 角落装饰 - 增强版 */}
          {/* 左上角 */}
          <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-green-500/50 pointer-events-none">
            <div className="absolute top-0 left-0 w-6 h-6 border-t border-l border-green-400/40"></div>
            <div className="absolute top-1 left-1 w-2 h-2 bg-green-400/25 rounded-full animate-pulse" style={{ boxShadow: '0 0 4px rgba(10,255,10,0.5)' }}></div>
            {/* 发光线条 */}
            <div className="absolute top-0 left-0 w-12 h-[2px] bg-gradient-to-r from-green-500/50 to-transparent"></div>
            <div className="absolute top-0 left-0 w-[2px] h-12 bg-gradient-to-b from-green-500/50 to-transparent"></div>
          </div>
          
          {/* 右上角 */}
          <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-green-500/50 pointer-events-none">
            <div className="absolute top-0 right-0 w-6 h-6 border-t border-r border-green-400/40"></div>
            <div className="absolute top-1 right-1 w-2 h-2 bg-green-400/25 rounded-full animate-pulse" style={{ boxShadow: '0 0 4px rgba(10,255,10,0.5)' }}></div>
            {/* 发光线条 */}
            <div className="absolute top-0 right-0 w-12 h-[2px] bg-gradient-to-l from-green-500/50 to-transparent"></div>
            <div className="absolute top-0 right-0 w-[2px] h-12 bg-gradient-to-b from-green-500/50 to-transparent"></div>
          </div>
          
          {/* 左下角 */}
          <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-green-500/50 pointer-events-none">
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b border-l border-green-400/40"></div>
            <div className="absolute bottom-1 left-1 w-2 h-2 bg-green-400/25 rounded-full animate-pulse" style={{ boxShadow: '0 0 4px rgba(10,255,10,0.5)' }}></div>
            {/* 发光线条 */}
            <div className="absolute bottom-0 left-0 w-12 h-[2px] bg-gradient-to-r from-green-500/50 to-transparent"></div>
            <div className="absolute bottom-0 left-0 w-[2px] h-12 bg-gradient-to-t from-green-500/50 to-transparent"></div>
          </div>
          
          {/* 右下角 */}
          <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-green-500/50 pointer-events-none">
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b border-r border-green-400/40"></div>
            <div className="absolute bottom-1 right-1 w-2 h-2 bg-green-400/25 rounded-full animate-pulse" style={{ boxShadow: '0 0 4px rgba(10,255,10,0.5)' }}></div>
            {/* 发光线条 */}
            <div className="absolute bottom-0 right-0 w-12 h-[2px] bg-gradient-to-l from-green-500/50 to-transparent"></div>
            <div className="absolute bottom-0 right-0 w-[2px] h-12 bg-gradient-to-t from-green-500/50 to-transparent"></div>
          </div>
          
          {/* 边缘光效 */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-green-500/40 to-transparent pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-green-500/40 to-transparent pointer-events-none"></div>
          <div className="absolute top-0 bottom-0 left-0 w-[1px] bg-gradient-to-b from-transparent via-green-500/40 to-transparent pointer-events-none"></div>
          <div className="absolute top-0 bottom-0 right-0 w-[1px] bg-gradient-to-b from-transparent via-green-500/40 to-transparent pointer-events-none"></div>

          {/* 通知提示 */}
          {notification && (
            <div className={`fixed top-4 right-4 z-[300] px-6 py-4 rounded-lg border-2 shadow-lg backdrop-blur-md transition-all ${
              notification.type === 'success' 
                ? 'bg-green-500/20 border-green-500/50 text-green-300'
                : notification.type === 'error'
                ? 'bg-red-500/20 border-red-500/50 text-red-300'
                : 'bg-blue-500/20 border-blue-500/50 text-blue-300'
            }`}>
              <div className="flex items-center gap-3">
                <span className="cyber-button-text text-sm">{notification.message}</span>
                <button
                  onClick={() => setNotification(null)}
                  className="text-current hover:opacity-70 transition-opacity"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* 内容区域 - 带自定义滚动条（仅在HUD屏幕右侧） */}
          <div 
            ref={contentRef}
            className="relative training-hud-content" 
            style={{ 
              maxHeight: isFullscreen ? 'calc(98vh - 120px)' : '75vh', 
              overflowY: 'auto',
              overflowX: 'hidden',
              height: isFullscreen ? 'calc(98vh - 120px)' : 'auto',
              paddingLeft: '2.5rem',
              paddingRight: '2rem',
              paddingTop: '1rem',
              paddingBottom: '1rem'
            }}
          >

            {/* 音频播放器 - HUD风格 */}
            <div className="p-6 mb-6 bg-black/40 border-2 border-green-500/40 rounded-lg relative overflow-hidden">
              {/* 背景装饰 */}
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_49%,rgba(10,255,10,0.05)_50%,transparent_51%)] bg-[length:20px_100%] opacity-30"></div>
              
              {/* 标题 */}
              <div className="flex items-center gap-2 mb-4 relative z-10">
                <div className="w-1 h-4 bg-green-500"></div>
                <h3 className="text-green-400 cyber-label text-sm">AUDIO PLAYER</h3>
              </div>

              {/* 隐藏的原生音频控件，用于实际播放 */}
              <audio
                ref={audioRef}
                src={getAudioSrc(item.audioUrl)}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onLoadedData={() => setAudioLoaded(true)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
              />

              {!audioLoaded ? (
                <div className="text-center py-8">
                  <div className="inline-flex items-center gap-2 cyber-text text-green-400/70 text-sm">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span>[ LOADING AUDIO... ]</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 relative z-10">
                  {/* 进度条 */}
                  <div className="relative">
                    <input
                      type="range"
                      min="0"
                      max={duration || 0}
                      value={currentTime}
                      onChange={handleSeek}
                      className="w-full h-2 bg-black/60 rounded-lg appearance-none cursor-pointer audio-slider"
                      style={{
                        background: `linear-gradient(to right, rgba(10,255,10,0.5) 0%, rgba(10,255,10,0.5) ${duration > 0 ? (currentTime / duration) * 100 : 0}%, rgba(10,255,10,0.1) ${duration > 0 ? (currentTime / duration) * 100 : 0}%, rgba(10,255,10,0.1) 100%)`
                      }}
                    />
                  </div>

                  {/* 控制按钮和时间显示 */}
                  <div className="flex items-center justify-center gap-4">
                    {/* 播放/暂停按钮 */}
                    <button
                      onClick={handlePlayPause}
                      className="w-12 h-12 rounded-full border-2 border-green-500/50 bg-green-500/10 flex items-center justify-center hover:bg-green-500/20 hover:border-green-500/70 transition-all group"
                      style={{ boxShadow: '0 0 15px rgba(10,255,10,0.3)' }}
                      title="播放/暂停 (空格)"
                    >
                      {isPlaying ? (
                        <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                        </svg>
                      ) : (
                        <svg className="w-6 h-6 text-green-400 ml-1" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      )}
                    </button>

                    {/* 时间显示 */}
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-xs cyber-label text-green-500/60 mb-1">CURRENT</div>
                        <div className="text-lg cyber-number cyber-tabular text-green-400 cyber-glow-pulse">
                          {formatTime(currentTime)}
                        </div>
                      </div>
                      <div className="text-green-500/40 cyber-text">/</div>
                      <div className="text-center">
                        <div className="text-xs cyber-label text-green-500/60 mb-1">TOTAL</div>
                        <div className="text-lg cyber-number cyber-tabular text-green-400/80">
                          {formatTime(duration)}
                        </div>
                      </div>
                    </div>

                    {/* 进度百分比 */}
                    <div className="text-right">
                      <div className="text-xs cyber-label text-green-500/60 mb-1">PROGRESS</div>
                      <div className="text-lg cyber-number cyber-tabular text-green-400 cyber-glow-pulse">
                        {duration > 0 ? Math.round((currentTime / duration) * 100) : 0}%
                      </div>
                    </div>
                  </div>

                  {/* 播放速度控制 */}
                  <div className="flex items-center gap-3 mt-4 pt-4 border-t border-green-500/20">
                    <span className="text-xs cyber-label text-green-500/60">SPEED:</span>
                    <div className="flex gap-2">
                      {[0.5, 0.75, 1, 1.25, 1.5].map((rate) => (
                        <button
                          key={rate}
                          onClick={() => handleSpeedChange(rate)}
                          className={`px-3 py-1 rounded border transition-all cyber-button-text text-xs ${
                            playbackRate === rate
                              ? 'bg-green-500/30 border-green-500/70 text-green-300'
                              : 'bg-black/40 border-green-500/30 text-green-400/70 hover:bg-green-500/10 hover:border-green-500/50'
                          }`}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 波形可视化装饰 */}
                  <div className="flex items-end justify-center gap-1 h-8 mt-2">
                    {[...Array(20)].map((_, i) => {
                      const isActive = Math.random() > 0.7
                      const height = isActive ? Math.random() * 0.6 + 0.4 : Math.random() * 0.3 + 0.1
                      return (
                        <div
                          key={i}
                          className="w-1 bg-green-500/40 rounded-t transition-all duration-100"
                          style={{
                            height: `${height * 100}%`,
                            opacity: isActive && isPlaying ? 1 : 0.4,
                            boxShadow: isActive && isPlaying ? '0 0 4px rgba(10,255,10,0.8)' : 'none'
                          }}
                        ></div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 控制选项 - 翻译显示已移至右下角按钮 */}

            {/* 句子列表 */}
            <div className="space-y-5">
              {item.sentences.map((sentence, index) => {
                const isActive = currentSentenceIndex === index
                const isRepeating = repeatMode === index
                const isNotesExpanded = expandedNotes.has(sentence.id)
                const notes = userNotes[sentence.id] || { words: '' }

                return (
                  <div
                    key={sentence.id}
                    ref={(el) => {
                      sentenceRefs.current[index] = el
                    }}
                    className="pl-8 pr-4 py-3 transition-all duration-300 rounded"
                    style={isActive ? {
                      background: 'rgba(10,255,10,0.15)',
                      border: '2px solid rgba(10,255,10,0.6)',
                      boxShadow: '0 0 25px rgba(10,255,10,0.4), inset 0 0 15px rgba(10,255,10,0.15)',
                      backdropFilter: 'blur(4px)',
                      transform: 'scale(1.02)'
                    } : {
                      background: 'rgba(10,255,10,0.03)',
                      border: '1px solid rgba(10,255,10,0.2)',
                      backdropFilter: 'blur(4px)',
                      transform: 'scale(1)'
                    }}
                  >
                    {/* 句子文本 */}
                    <div className="flex items-start gap-3 mb-2">
                      <div
                        onClick={() => handleSentenceClick(sentence)}
                        className={`flex-1 text-left px-2 py-2 cyber-text transition-all rounded cursor-pointer select-text ${
                          isActive
                            ? 'text-green-200 bg-green-500/10'
                            : 'text-gray-200 hover:text-green-300 hover:bg-green-500/5'
                        }`}
                      >
                        <p className="text-base cyber-font font-bold leading-relaxed select-text">{sentence.text}</p>
                      </div>
                      <button
                        onClick={() => handleRepeatClick(index)}
                        className={`px-3 py-2 cyber-button-text text-sm transition-all border rounded ${
                          isRepeating
                            ? 'bg-red-500/20 text-red-300 border-red-400/50'
                            : 'border-green-500/30 text-green-300 hover:text-green-200 hover:border-green-500/50 bg-green-500/5 hover:bg-green-500/10'
                        }`}
                        title="单句重复播放"
                      >
                        🔁
                      </button>
                    </div>

                    {/* 翻译 */}
                    {showTranslations && sentence.translation && (
                      <div className="mb-2 px-2 py-2 border-l-2 border-green-500/40 select-text">
                        <p className="text-green-300/80 cyber-text text-sm leading-relaxed select-text">{sentence.translation}</p>
                      </div>
                    )}

                    {/* 时间信息 */}
                    <div className="text-xs cyber-label text-green-500/60 mb-2 px-2">
                      TIME: [<span className="cyber-number cyber-tabular">{sentence.startTime.toFixed(2)}</span>s - <span className="cyber-number cyber-tabular">{sentence.endTime.toFixed(2)}</span>s]
                    </div>

                    {/* 用户词汇 */}
                    <div className="border-t border-green-500/20 pt-2 mt-2 px-2">
                      <button
                        onClick={() => toggleNotes(sentence.id)}
                        className="w-full text-left text-xs cyber-label text-green-400/70 hover:text-green-300 flex items-center justify-between transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          📝 VOCABULARY
                          {savingNotes[sentence.id] && (
                            <span className="text-[10px] text-green-400/60 animate-pulse">[保存中...]</span>
                          )}
                        </span>
                        <span className="transition-transform duration-200" style={{ transform: isNotesExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                          {isNotesExpanded ? '▼' : '▶'}
                        </span>
                      </button>

                      {isNotesExpanded && (
                        <div className="mt-4 animate-fade-in">
                          <label className="block text-green-300 cyber-label text-xs mb-2">
                            VOCABULARY
                          </label>
                          <textarea
                            value={notes.words}
                            onChange={(e) =>
                              handleNotesChange(sentence.id, e.target.value)
                            }
                            placeholder="Record vocabulary..."
                            className="w-full px-4 py-2 bg-black/40 border border-green-500/30 cyber-input-font text-gray-200 text-sm focus:outline-none focus:border-green-500/60 focus:bg-black/60 transition-all resize-none"
                            rows={2}
                          />
                          <div className="mt-1 text-[9px] cyber-label text-green-500/50">
                            自动保存中...
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

      {/* 编辑模态框 */}
      {isEditing && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setIsEditing(false)}>
          <div className="w-[95%] max-w-5xl mx-auto relative bg-black/90 border-2 border-green-500/50 rounded-lg overflow-hidden shadow-[0_0_40px_rgba(10,255,10,0.3),inset_0_0_30px_rgba(10,255,10,0.1)] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* 顶部装饰栏 */}
            <div className="relative border-b-2 border-green-500/50 bg-gradient-to-r from-green-900/30 via-transparent to-transparent p-4 sticky top-0 bg-black/90 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(10,255,10,0.8)]"></div>
                  <h1 className="text-2xl cyber-title text-green-400 cyber-neon">
                    [ EDIT MODULE ]
                  </h1>
                </div>
                <button
                  onClick={() => setIsEditing(false)}
                  className="text-green-400/70 hover:text-green-300 cyber-button-text text-sm transition-colors px-3 py-1 border border-green-500/30 hover:border-green-500/50 rounded"
                >
                  ✕ CLOSE
                </button>
              </div>
              <div className="mt-2 text-xs cyber-label text-green-500/60">
                TRAINING ITEM EDIT INTERFACE
              </div>
            </div>

            {/* HUD网格背景 */}
            <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_24%,rgba(10,255,10,.05)_25%,rgba(10,255,10,.05)_26%,transparent_27%,transparent_74%,rgba(10,255,10,.05)_75%,rgba(10,255,10,.05)_76%,transparent_77%,transparent),linear-gradient(90deg,transparent_24%,rgba(10,255,10,.05)_25%,rgba(10,255,10,.05)_26%,transparent_27%,transparent_74%,rgba(10,255,10,.05)_75%,rgba(10,255,10,.05)_76%,transparent_77%,transparent)] bg-[length:40px_40px] pointer-events-none opacity-30"></div>

            {/* 扫描线效果 */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(10,255,10,0.03),rgba(10,255,10,0.01),rgba(10,255,10,0.03))] bg-[length:100%_3px,4px_100%] pointer-events-none opacity-40"></div>

            {/* 角落装饰 */}
            <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-green-500/50"></div>
            <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-green-500/50"></div>
            <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-green-500/50"></div>
            <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-green-500/50"></div>

            {/* 内容区域 */}
            <div className="relative p-8">
              <form onSubmit={handleEditSubmit} className="space-y-8">
                {/* 基础信息区域 */}
                <div className="space-y-6">
                  <div className="border-l-2 border-green-500/50 pl-4">
                    <label className="block text-green-400 cyber-label text-sm mb-3 flex items-center gap-2">
                      <span className="w-1 h-1 bg-green-400 rounded-full"></span>
                      TITLE *
                    </label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-4 py-3 bg-black/40 border border-green-500/30 cyber-input-font text-gray-200 focus:outline-none focus:border-green-500/60 focus:bg-black/60 transition-all"
                      placeholder="Enter training item title..."
                      required
                    />
                  </div>

                  <div className="border-l-2 border-green-500/50 pl-4">
                    <label className="block text-green-400 cyber-label text-sm mb-3 flex items-center gap-2">
                      <span className="w-1 h-1 bg-green-400 rounded-full"></span>
                      AUDIO FILE (OPTIONAL - 留空则保持原文件)
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={(e) => setEditAudioFile(e.target.files?.[0] || null)}
                        className="w-full px-4 py-3 bg-black/40 border border-green-500/30 cyber-input-font text-gray-300 focus:outline-none focus:border-green-500/60 focus:bg-black/60 transition-all file:mr-4 file:py-1 file:px-3 file:border-0 file:bg-green-500/20 file:text-green-400 file:cyber-button-text file:text-sm file:cursor-pointer hover:file:bg-green-500/30"
                      />
                      {editAudioFile && (
                        <div className="mt-2 text-xs cyber-text text-green-400/70">
                          Selected: {editAudioFile.name}
                        </div>
                      )}
                      {!editAudioFile && item && (
                        <div className="mt-2 text-xs cyber-text text-green-400/50">
                          Current: {item.audioUrl.split('/').pop()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 句子分段区域 */}
                <div className="border-t-2 border-green-500/30 pt-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-[2px] w-8 bg-green-500"></div>
                    <h2 className="text-xl cyber-title text-green-400">SENTENCE SEGMENTS</h2>
                    <div className="flex-1 h-[1px] bg-gradient-to-r from-green-500/50 to-transparent"></div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs cyber-label text-green-500/60">COUNT: <span className="cyber-number cyber-tabular">{editSentences.length}</span></span>
                      {hasUnsavedEditSentence && (
                        <span className="text-xs cyber-text text-yellow-400/70 animate-pulse">(+1 UNSAVED)</span>
                      )}
                    </div>
                  </div>

                  {/* 已添加的句子列表 */}
                  {editSentences.length > 0 && (
                    <div className="space-y-3 mb-6 max-h-64 overflow-y-auto pr-2">
                      {editSentences.map((sentence, index) => (
                        <div
                          key={index}
                          className={`p-4 bg-black/40 border rounded relative group hover:border-green-500/40 transition-all ${
                            editingSentenceIndex === index 
                              ? 'border-green-500/60 bg-green-500/10' 
                              : 'border-green-500/20'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs cyber-number cyber-tabular text-green-500/70">#{index + 1}</span>
                                <p className="cyber-text text-gray-200 text-sm select-text">{sentence.text}</p>
                                {editingSentenceIndex === index && (
                                  <span className="text-xs cyber-text text-yellow-400/70 animate-pulse">[编辑中]</span>
                                )}
                              </div>
                              {sentence.translation && (
                                <p className="text-xs cyber-text text-gray-400 mb-2 ml-6 select-text">{sentence.translation}</p>
                              )}
                              <p className="text-xs cyber-label text-green-500/60 ml-6">
                                TIME: [<span className="cyber-number cyber-tabular">{sentence.startTime.toFixed(2)}</span>s - <span className="cyber-number cyber-tabular">{sentence.endTime.toFixed(2)}</span>s]
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditSentence(index)}
                                className={`text-green-400/60 hover:text-green-400 cyber-button-text text-xs transition-colors px-2 py-1 border rounded ${
                                  editingSentenceIndex === index
                                    ? 'border-green-500/60 bg-green-500/20 text-green-300'
                                    : 'border-green-500/30 hover:border-green-500/50 hover:bg-green-500/10'
                                }`}
                                disabled={editingSentenceIndex === index}
                              >
                                {editingSentenceIndex === index ? 'EDITING' : 'EDIT'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditRemoveSentence(index)}
                                className="text-red-400/60 hover:text-red-400 cyber-button-text text-xs transition-colors px-2 py-1 border border-red-500/30 hover:border-red-500/50 rounded"
                              >
                                DEL
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 添加/编辑句子表单 */}
                  <div className="p-6 bg-black/30 border border-green-500/20 rounded space-y-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 bg-green-500"></div>
                        <h3 className="text-green-400 cyber-label text-sm">
                          {editingSentenceIndex !== null ? (
                            <>EDIT SEGMENT #<span className="cyber-number cyber-tabular">{editingSentenceIndex + 1}</span></>
                          ) : 'ADD NEW SEGMENT'}
                        </h3>
                      </div>
                      {editingSentenceIndex !== null && (
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="text-gray-400/70 hover:text-gray-300 cyber-button-text text-xs transition-colors px-3 py-1 border border-gray-600/30 hover:border-gray-500/50 rounded"
                        >
                          CANCEL EDIT
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-green-400/80 cyber-label text-xs mb-2 flex items-center gap-2">
                        <span className="w-1 h-1 bg-green-400 rounded-full"></span>
                        ENGLISH TEXT *
                      </label>
                      <textarea
                        value={editCurrentSentence.text}
                        onChange={(e) =>
                          setEditCurrentSentence({ ...editCurrentSentence, text: e.target.value })
                        }
                        className="w-full px-4 py-3 bg-black/40 border border-green-500/30 cyber-input-font text-gray-200 focus:outline-none focus:border-green-500/60 focus:bg-black/60 transition-all resize-none"
                        rows={3}
                        placeholder="Enter English sentence..."
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-green-400/80 cyber-label text-xs mb-2 flex items-center gap-2">
                        <span className="w-1 h-1 bg-green-400 rounded-full"></span>
                        CHINESE TRANSLATION
                      </label>
                      <input
                        type="text"
                        value={editCurrentSentence.translation}
                        onChange={(e) =>
                          setEditCurrentSentence({ ...editCurrentSentence, translation: e.target.value })
                        }
                        className="w-full px-4 py-3 bg-black/40 border border-green-500/30 cyber-input-font text-gray-200 focus:outline-none focus:border-green-500/60 focus:bg-black/60 transition-all"
                        placeholder="Enter Chinese translation (optional)..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-green-400/80 cyber-label text-xs mb-2 flex items-center gap-2">
                          <span className="w-1 h-1 bg-green-400 rounded-full"></span>
                          START TIME (S) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={editCurrentSentence.startTime}
                          onChange={(e) =>
                            setEditCurrentSentence({
                              ...editCurrentSentence,
                              startTime: parseFloat(e.target.value) || 0
                            })
                          }
                          className="w-full px-4 py-3 bg-black/40 border border-green-500/30 cyber-number cyber-tabular text-gray-200 focus:outline-none focus:border-green-500/60 focus:bg-black/60 transition-all"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-green-400/80 cyber-label text-xs mb-2 flex items-center gap-2">
                          <span className="w-1 h-1 bg-green-400 rounded-full"></span>
                          END TIME (S) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={editCurrentSentence.endTime}
                          onChange={(e) =>
                            setEditCurrentSentence({
                              ...editCurrentSentence,
                              endTime: parseFloat(e.target.value) || 0
                            })
                          }
                          className="w-full px-4 py-3 bg-black/40 border border-green-500/30 cyber-number cyber-tabular text-gray-200 focus:outline-none focus:border-green-500/60 focus:bg-black/60 transition-all"
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleEditAddSentence}
                      className="w-full px-6 py-3 bg-green-500/10 border-2 border-green-500/50 cyber-button-text text-green-400 text-sm hover:bg-green-500/20 hover:border-green-500/70 hover:text-green-300 transition-all duration-300"
                    >
                      {editingSentenceIndex !== null ? '✓ UPDATE SEGMENT' : '+ ADD SEGMENT'}
                    </button>
                  </div>
                </div>

                {/* 底部操作栏 */}
                <div className="flex gap-4 pt-6 border-t-2 border-green-500/30 relative" style={{ zIndex: 100 }}>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="flex-1 px-8 py-4 bg-green-500/20 border-2 border-green-500/60 cyber-button-text text-green-400 text-sm hover:bg-green-500/30 hover:border-green-500/80 hover:text-green-300 transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-green-500/20 disabled:hover:border-green-500/60 disabled:hover:text-green-400 cursor-pointer relative"
                  style={{ zIndex: 100 }}
                >
                  {isUpdating ? '[ UPDATING... ]' : '[ UPDATE ]'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-8 py-4 bg-black/40 border-2 border-gray-600/50 cyber-button-text text-gray-400 text-sm hover:bg-black/60 hover:border-gray-500/70 hover:text-gray-300 transition-all duration-300 cursor-pointer relative"
                  style={{ zIndex: 100 }}
                >
                  [ CANCEL ]
                </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
