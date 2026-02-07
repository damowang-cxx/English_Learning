'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Sentence {
  text: string
  translation: string
  startTime: number
  endTime: number
}

export default function UploadPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [sentences, setSentences] = useState<Sentence[]>([])
  const [currentSentence, setCurrentSentence] = useState<Sentence>({
    text: '',
    translation: '',
    startTime: 0,
    endTime: 0
  })
  const [isUploading, setIsUploading] = useState(false)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({})
  
  // 输入框引用
  const titleInputRef = useRef<HTMLInputElement>(null)
  const englishTextRef = useRef<HTMLTextAreaElement>(null)
  const startTimeRef = useRef<HTMLInputElement>(null)
  const endTimeRef = useRef<HTMLInputElement>(null)

  // 页面加载时自动聚焦到标题输入框
  useEffect(() => {
    titleInputRef.current?.focus()
  }, [])

  // 验证当前句子
  const validateCurrentSentence = (): boolean => {
    const newErrors: { [key: string]: string } = {}
    
    if (!currentSentence.text.trim()) {
      newErrors.text = '请填写英语句子'
    }
    
    if (currentSentence.startTime < 0) {
      newErrors.startTime = '开始时间不能为负数'
    }
    
    if (currentSentence.endTime <= currentSentence.startTime) {
      newErrors.endTime = '结束时间必须大于开始时间'
    }
    
    setValidationErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleAddSentence = () => {
    if (!validateCurrentSentence()) {
      return
    }
    
    // 添加句子到列表
    setSentences([...sentences, { ...currentSentence }])
    setCurrentSentence({
      text: '',
      translation: '',
      startTime: currentSentence.endTime,
      endTime: currentSentence.endTime
    })
    setValidationErrors({})
    
    // 聚焦到英语文本输入框
    setTimeout(() => {
      englishTextRef.current?.focus()
    }, 100)
  }

  // 键盘快捷键处理
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/Cmd + Enter 提交表单
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit(e as any)
      return
    }
    
    // Enter 添加句子（在英语文本框中）
    if (e.key === 'Enter' && !e.shiftKey && document.activeElement === englishTextRef.current) {
      e.preventDefault()
      handleAddSentence()
      return
    }
    
    // Tab 键在时间输入框之间切换时自动填充
    if (e.key === 'Tab' && document.activeElement === startTimeRef.current) {
      if (!currentSentence.endTime || currentSentence.endTime <= currentSentence.startTime) {
        setCurrentSentence({
          ...currentSentence,
          endTime: currentSentence.startTime + 1
        })
      }
    }
  }
  
  // 检查当前是否有未保存的句子
  const hasUnsavedSentence = currentSentence.text.trim() && 
                              currentSentence.startTime >= 0 && 
                              currentSentence.endTime > currentSentence.startTime

  const handleRemoveSentence = (index: number) => {
    setSentences(sentences.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 验证表单
    const newErrors: { [key: string]: string } = {}
    
    if (!title.trim()) {
      newErrors.title = '请填写标题'
    }
    
    if (!audioFile) {
      newErrors.audio = '请选择音频文件'
    }
    
    if (sentences.length === 0 && !currentSentence.text.trim()) {
      newErrors.sentences = '请至少添加一个句子分段'
    }
    
    setErrors(newErrors)
    
    if (Object.keys(newErrors).length > 0) {
      // 滚动到第一个错误
      const firstErrorKey = Object.keys(newErrors)[0]
      if (firstErrorKey === 'title') {
        titleInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        titleInputRef.current?.focus()
      }
      return
    }
    
    // 检查是否有未保存的句子
    const hasUnsaved = currentSentence.text.trim() && 
                       currentSentence.startTime >= 0 && 
                       currentSentence.endTime > currentSentence.startTime
    
    let finalSentences = [...sentences]
    
    if (hasUnsaved) {
      if (!validateCurrentSentence()) {
        setErrors({ sentences: '请先完成并保存未完成的句子分段' })
        englishTextRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        englishTextRef.current?.focus()
        return
      }
      finalSentences = [...sentences, { ...currentSentence }]
    }
    
    if (finalSentences.length === 0) {
      setErrors({ sentences: '请至少添加一个句子分段' })
      return
    }

    // 检查音频文件是否存在
    if (!audioFile) {
      setErrors({ audio: '请选择音频文件' })
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('title', title)
      formData.append('audio', audioFile)
      formData.append('sentences', JSON.stringify(finalSentences))

      console.log('Sending request...', { sentencesCount: finalSentences.length })
      const response = await fetch('/api/training-items', {
        method: 'POST',
        body: formData
      })

      console.log('Response status:', response.status)
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Upload failed:', errorText)
        throw new Error(`上传失败: ${response.status}`)
      }

      const data = await response.json()
      console.log('Upload success:', data)
      router.push(`/training/${data.id}`)
    } catch (error) {
      console.error('Upload error:', error)
      setErrors({ submit: `上传失败，请重试: ${error instanceof Error ? error.message : '未知错误'}` })
    } finally {
      setIsUploading(false)
    }
  }

  // 时间快捷调整函数
  const adjustTime = (field: 'startTime' | 'endTime', delta: number) => {
    setCurrentSentence({
      ...currentSentence,
      [field]: Math.max(0, currentSentence[field] + delta)
    })
    setValidationErrors({})
  }

  // 格式化时间显示
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = (seconds % 60).toFixed(2)
    return mins > 0 ? `${mins}:${secs.padStart(5, '0')}` : `${secs}s`
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center" style={{ paddingBottom: '45vh', paddingTop: '10vh' }}>
      {/* HUD屏幕容器 */}
      <div className="w-[95%] max-w-5xl mx-auto relative" style={{ zIndex: 50 }}>
        {/* 主HUD屏幕 */}
        <div className="relative bg-black/70 backdrop-blur-md border-2 border-red-500/50 rounded-lg overflow-hidden shadow-[0_0_40px_rgba(255,0,0,0.3),inset_0_0_30px_rgba(255,0,0,0.1)]">
          {/* 顶部装饰栏 */}
          <div className="relative border-b-2 border-red-500/50 bg-gradient-to-r from-red-900/30 via-transparent to-transparent p-4 z-10">
            <div className="flex items-center justify-between relative z-20">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(255,0,0,0.8)]"></div>
                <h1 className="text-2xl cyber-title text-red-400 cyber-neon">
                  [ UPLOAD MODULE ]
                </h1>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  router.push('/')
                }}
                className="text-red-400/70 hover:text-red-300 cyber-button-text text-sm transition-colors px-3 py-1 border border-red-500/30 hover:border-red-500/50 rounded cursor-pointer relative z-30"
                style={{ zIndex: 100 }}
                type="button"
              >
                ← BACK
              </button>
            </div>
            <div className="mt-2 text-xs cyber-label text-red-500/60 relative z-20">
              TRAINING ITEM CREATION INTERFACE
            </div>
          </div>

          {/* HUD网格背景 */}
          <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_24%,rgba(255,0,0,.05)_25%,rgba(255,0,0,.05)_26%,transparent_27%,transparent_74%,rgba(255,0,0,.05)_75%,rgba(255,0,0,.05)_76%,transparent_77%,transparent),linear-gradient(90deg,transparent_24%,rgba(255,0,0,.05)_25%,rgba(255,0,0,.05)_26%,transparent_27%,transparent_74%,rgba(255,0,0,.05)_75%,rgba(255,0,0,.05)_76%,transparent_77%,transparent)] bg-[length:40px_40px] pointer-events-none opacity-30"></div>

          {/* 扫描线效果 */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(255,0,0,0.01),rgba(255,0,0,0.03))] bg-[length:100%_3px,4px_100%] pointer-events-none opacity-40"></div>

          {/* 角落装饰 */}
          <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-red-500/50"></div>
          <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-red-500/50"></div>
          <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-red-500/50"></div>
          <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-red-500/50"></div>

          {/* 内容区域 */}
          <div className="relative p-8">
            <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-8">
              {/* 基础信息区域 */}
              <div className="space-y-6">
                <div className="border-l-2 border-red-500/50 pl-4">
                  <label className="block text-red-400 cyber-label mb-3 flex items-center gap-2">
                    <span className="w-1 h-1 bg-red-400 rounded-full"></span>
                    TITLE *
                    {title.length > 0 && (
                      <span className="text-[10px] cyber-number text-red-500/60 normal-case ml-auto">
                        {title.length} chars
                      </span>
                    )}
                  </label>
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value)
                      if (errors.title) {
                        setErrors({ ...errors, title: '' })
                      }
                    }}
                    className={`w-full px-4 py-3 bg-black/40 border cyber-input-font text-gray-200 focus:outline-none focus:bg-black/60 transition-all ${
                      errors.title 
                        ? 'border-red-500/80 focus:border-red-500' 
                        : 'border-red-500/30 focus:border-red-500/60'
                    }`}
                    placeholder="Enter training item title..."
                    required
                  />
                  {errors.title && (
                    <div className="mt-1 text-xs cyber-text text-red-400/80 animate-pulse">
                      ⚠ {errors.title}
                    </div>
                  )}
                </div>

                <div className="border-l-2 border-red-500/50 pl-4">
                  <label className="block text-red-400 cyber-label mb-3 flex items-center gap-2">
                    <span className="w-1 h-1 bg-red-400 rounded-full"></span>
                    AUDIO FILE *
                    {audioFile && (
                      <span className="text-[10px] cyber-number text-red-500/60 normal-case ml-auto">
                        {(audioFile.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(e) => {
                        setAudioFile(e.target.files?.[0] || null)
                        if (errors.audio) {
                          setErrors({ ...errors, audio: '' })
                        }
                      }}
                      className={`w-full px-4 py-3 bg-black/40 border cyber-input-font text-gray-300 focus:outline-none focus:bg-black/60 transition-all file:mr-4 file:py-1 file:px-3 file:border-0 file:bg-red-500/20 file:text-red-400 file:cyber-button-text file:text-sm file:cursor-pointer hover:file:bg-red-500/30 ${
                        errors.audio 
                          ? 'border-red-500/80 focus:border-red-500' 
                          : 'border-red-500/30 focus:border-red-500/60'
                      }`}
                      required
                    />
                    {audioFile && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="text-xs cyber-text text-red-400/70 flex-1">
                          ✓ Selected: {audioFile.name}
                        </div>
                        <button
                          type="button"
                          onClick={() => setAudioFile(null)}
                          className="text-xs cyber-button-text text-red-400/60 hover:text-red-400 px-2 py-1 border border-red-500/30 hover:border-red-500/50 rounded transition-colors"
                        >
                          CLEAR
                        </button>
                      </div>
                    )}
                    {errors.audio && (
                      <div className="mt-1 text-xs cyber-text text-red-400/80 animate-pulse">
                        ⚠ {errors.audio}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 句子分段区域 */}
              <div className="border-t-2 border-red-500/30 pt-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-[2px] w-8 bg-red-500"></div>
                  <h2 className="text-xl cyber-title text-red-400">SENTENCE SEGMENTS</h2>
                  <div className="flex-1 h-[1px] bg-gradient-to-r from-red-500/50 to-transparent"></div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs cyber-label text-red-500/60">COUNT: <span className="cyber-number cyber-tabular">{sentences.length}</span></span>
                    {hasUnsavedSentence && (
                      <span className="text-xs cyber-text text-yellow-400/70 animate-pulse">(+1 UNSAVED)</span>
                    )}
                  </div>
                </div>

                {/* 已添加的句子列表 */}
                {sentences.length > 0 && (
                  <div className="space-y-3 mb-6 max-h-64 overflow-y-auto pr-2">
                    {sentences.map((sentence, index) => (
                      <div
                        key={index}
                        className="p-4 bg-black/40 border border-red-500/20 rounded relative group hover:border-red-500/40 transition-all"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs cyber-number cyber-tabular text-red-500/70">#{index + 1}</span>
                              <p className="cyber-text text-gray-200 text-sm">{sentence.text}</p>
                            </div>
                            {sentence.translation && (
                              <p className="text-xs cyber-text text-gray-400 mb-2 ml-6">{sentence.translation}</p>
                            )}
                            <p className="text-xs cyber-label text-red-500/60 ml-6">
                              TIME: [<span className="cyber-number cyber-tabular">{sentence.startTime.toFixed(2)}</span>s - <span className="cyber-number cyber-tabular">{sentence.endTime.toFixed(2)}</span>s]
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveSentence(index)}
                            className="text-red-400/60 hover:text-red-400 ml-4 cyber-button-text text-xs transition-colors px-2 py-1 border border-red-500/30 hover:border-red-500/50 rounded"
                          >
                            DEL
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 添加新句子表单 */}
                <div className="p-6 bg-black/30 border border-red-500/20 rounded space-y-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-4 bg-red-500"></div>
                    <h3 className="text-red-400 cyber-label text-sm">ADD NEW SEGMENT</h3>
                  </div>

                  <div>
                    <label className="block text-red-400/80 cyber-label text-xs mb-2 flex items-center gap-2">
                      <span className="w-1 h-1 bg-red-400 rounded-full"></span>
                      ENGLISH TEXT *
                      {currentSentence.text.length > 0 && (
                        <span className="text-[9px] cyber-number cyber-tabular text-red-500/60 normal-case ml-auto">
                          {currentSentence.text.length} chars
                        </span>
                      )}
                    </label>
                    <textarea
                      ref={englishTextRef}
                      value={currentSentence.text}
                      onChange={(e) => {
                        setCurrentSentence({ ...currentSentence, text: e.target.value })
                        if (validationErrors.text) {
                          setValidationErrors({ ...validationErrors, text: '' })
                        }
                      }}
                      className={`w-full px-4 py-3 bg-black/40 border cyber-input-font text-gray-200 focus:outline-none focus:bg-black/60 transition-all resize-none ${
                        validationErrors.text 
                          ? 'border-red-500/80 focus:border-red-500' 
                          : 'border-red-500/30 focus:border-red-500/60'
                      }`}
                      rows={3}
                      placeholder="Enter English sentence... (Press Enter to add)"
                      required
                    />
                    {validationErrors.text && (
                      <div className="mt-1 text-xs cyber-text text-red-400/80 animate-pulse">
                        ⚠ {validationErrors.text}
                      </div>
                    )}
                    <div className="mt-1 text-[9px] cyber-label text-red-500/50">
                      Tip: Press Enter to add segment, Ctrl+Enter to submit
                    </div>
                  </div>

                  <div>
                    <label className="block text-red-400/80 cyber-label text-xs mb-2 flex items-center gap-2">
                      <span className="w-1 h-1 bg-red-400 rounded-full"></span>
                      CHINESE TRANSLATION
                    </label>
                    <input
                      type="text"
                      value={currentSentence.translation}
                      onChange={(e) =>
                        setCurrentSentence({ ...currentSentence, translation: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-black/40 border border-red-500/30 cyber-input-font text-gray-200 focus:outline-none focus:border-red-500/60 focus:bg-black/60 transition-all"
                      placeholder="Enter Chinese translation (optional)..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-red-400/80 cyber-label text-xs mb-2 flex items-center gap-2">
                        <span className="w-1 h-1 bg-red-400 rounded-full"></span>
                        START TIME (S) *
                        {currentSentence.startTime > 0 && (
                          <span className="text-[9px] cyber-number cyber-tabular text-red-500/60 normal-case ml-auto">
                            {formatTime(currentSentence.startTime)}
                          </span>
                        )}
                      </label>
                      <div className="flex gap-2">
                        <input
                          ref={startTimeRef}
                          type="number"
                          step="0.01"
                          min="0"
                          value={currentSentence.startTime}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0
                            setCurrentSentence({
                              ...currentSentence,
                              startTime: value
                            })
                            if (validationErrors.startTime) {
                              setValidationErrors({ ...validationErrors, startTime: '' })
                            }
                          }}
                          className={`flex-1 px-4 py-3 bg-black/40 border cyber-number cyber-tabular text-gray-200 focus:outline-none focus:bg-black/60 transition-all ${
                            validationErrors.startTime 
                              ? 'border-red-500/80 focus:border-red-500' 
                              : 'border-red-500/30 focus:border-red-500/60'
                          }`}
                          required
                        />
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => adjustTime('startTime', 1)}
                            className="px-2 py-1 text-[10px] bg-red-500/20 border border-red-500/30 cyber-button-text text-red-400 hover:bg-red-500/30 transition-colors"
                            title="+1s"
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            onClick={() => adjustTime('startTime', -1)}
                            className="px-2 py-1 text-[10px] bg-red-500/20 border border-red-500/30 cyber-button-text text-red-400 hover:bg-red-500/30 transition-colors"
                            title="-1s"
                          >
                            -1
                          </button>
                        </div>
                      </div>
                      {validationErrors.startTime && (
                        <div className="mt-1 text-xs cyber-text text-red-400/80 animate-pulse">
                          ⚠ {validationErrors.startTime}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-red-400/80 cyber-label text-xs mb-2 flex items-center gap-2">
                        <span className="w-1 h-1 bg-red-400 rounded-full"></span>
                        END TIME (S) *
                        {currentSentence.endTime > 0 && (
                          <span className="text-[9px] cyber-number cyber-tabular text-red-500/60 normal-case ml-auto">
                            {formatTime(currentSentence.endTime)}
                          </span>
                        )}
                      </label>
                      <div className="flex gap-2">
                        <input
                          ref={endTimeRef}
                          type="number"
                          step="0.01"
                          min={currentSentence.startTime + 0.01}
                          value={currentSentence.endTime}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0
                            setCurrentSentence({
                              ...currentSentence,
                              endTime: value
                            })
                            if (validationErrors.endTime) {
                              setValidationErrors({ ...validationErrors, endTime: '' })
                            }
                          }}
                          className={`flex-1 px-4 py-3 bg-black/40 border cyber-number cyber-tabular text-gray-200 focus:outline-none focus:bg-black/60 transition-all ${
                            validationErrors.endTime 
                              ? 'border-red-500/80 focus:border-red-500' 
                              : 'border-red-500/30 focus:border-red-500/60'
                          }`}
                          required
                        />
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => adjustTime('endTime', 1)}
                            className="px-2 py-1 text-[10px] bg-red-500/20 border border-red-500/30 cyber-button-text text-red-400 hover:bg-red-500/30 transition-colors"
                            title="+1s"
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            onClick={() => adjustTime('endTime', -1)}
                            className="px-2 py-1 text-[10px] bg-red-500/20 border border-red-500/30 cyber-button-text text-red-400 hover:bg-red-500/30 transition-colors"
                            title="-1s"
                          >
                            -1
                          </button>
                        </div>
                      </div>
                      {validationErrors.endTime && (
                        <div className="mt-1 text-xs cyber-text text-red-400/80 animate-pulse">
                          ⚠ {validationErrors.endTime}
                        </div>
                      )}
                      {currentSentence.endTime <= currentSentence.startTime && currentSentence.endTime > 0 && (
                        <div className="mt-1 text-xs cyber-text text-yellow-400/80">
                          ⚠ End time should be greater than start time
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddSentence}
                    className="w-full px-6 py-3 bg-red-500/10 border-2 border-red-500/50 cyber-button-text text-red-400 text-sm hover:bg-red-500/20 hover:border-red-500/70 hover:text-red-300 transition-all duration-300 relative group"
                  >
                    <span className="relative z-10">+ ADD SEGMENT</span>
                    <span className="absolute inset-0 bg-red-500/10 scale-0 group-hover:scale-100 transition-transform duration-300"></span>
                    <span className="text-[9px] text-red-500/50 font-normal normal-case absolute right-4 top-1/2 transform -translate-y-1/2">
                      (Enter)
                    </span>
                  </button>
                </div>
              </div>

              {/* 错误提示 */}
              {(errors.submit || errors.sentences) && (
                <div className="pt-4 border-t border-red-500/30">
                  <div className="p-3 bg-red-500/10 border border-red-500/50 rounded">
                    <div className="text-xs cyber-text text-red-400">
                      {errors.submit && <div>⚠ {errors.submit}</div>}
                      {errors.sentences && <div>⚠ {errors.sentences}</div>}
                    </div>
                  </div>
                </div>
              )}

              {/* 底部操作栏 */}
              <div className="flex gap-4 pt-6 border-t-2 border-red-500/30 relative" style={{ zIndex: 100 }}>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="flex-1 px-8 py-4 bg-red-500/20 border-2 border-red-500/60 cyber-button-text text-red-400 text-sm hover:bg-red-500/30 hover:border-red-500/80 hover:text-red-300 transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-red-500/20 disabled:hover:border-red-500/60 disabled:hover:text-red-400 cursor-pointer relative group"
                  style={{ zIndex: 100 }}
                >
                  <span className="relative z-10">{isUploading ? '[ UPLOADING... ]' : '[ SUBMIT ]'}</span>
                  {!isUploading && (
                    <span className="text-[9px] text-red-500/50 font-normal normal-case absolute right-4 top-1/2 transform -translate-y-1/2">
                      (Ctrl+Enter)
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/')}
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
    </div>
  )
}
