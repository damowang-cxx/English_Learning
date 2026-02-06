'use client'

import { useState } from 'react'
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

  const handleAddSentence = () => {
    // 验证必填字段
    if (!currentSentence.text.trim()) {
      alert('请填写英语句子')
      return
    }
    if (currentSentence.startTime < 0 || currentSentence.endTime <= currentSentence.startTime) {
      alert('请填写有效的开始时间和结束时间（结束时间必须大于开始时间）')
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
    console.log('Submit clicked', { title, audioFile, sentences, currentSentence })
    
    // 检查是否有未保存的句子，如果有则提示用户先保存
    const hasUnsaved = currentSentence.text.trim() && 
                       currentSentence.startTime >= 0 && 
                       currentSentence.endTime > currentSentence.startTime
    
    let finalSentences = [...sentences]
    
    if (hasUnsaved) {
      const shouldAdd = confirm('检测到未保存的句子分段，是否先添加到列表？\n\n如果选择"取消"，将只提交已保存的句子。')
      if (shouldAdd) {
        // 验证并添加到最终列表
        if (!currentSentence.text.trim()) {
          alert('请填写英语句子')
          return
        }
        if (currentSentence.startTime < 0 || currentSentence.endTime <= currentSentence.startTime) {
          alert('请填写有效的开始时间和结束时间（结束时间必须大于开始时间）')
          return
        }
        finalSentences = [...sentences, { ...currentSentence }]
      }
    }
    
    if (!title || !audioFile || finalSentences.length === 0) {
      alert('请填写所有必填项：标题、音频文件和至少一个句子分段')
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
      alert(`上传失败，请重试: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center" style={{ paddingBottom: '45vh', paddingTop: '10vh' }}>
      {/* HUD屏幕容器 */}
      <div className="w-[95%] max-w-5xl mx-auto relative" style={{ zIndex: 50 }}>
        {/* 主HUD屏幕 */}
        <div className="relative bg-black/70 backdrop-blur-md border-2 border-red-500/50 rounded-lg overflow-hidden shadow-[0_0_40px_rgba(255,0,0,0.3),inset_0_0_30px_rgba(255,0,0,0.1)]">
          {/* 顶部装饰栏 */}
          <div className="relative border-b-2 border-red-500/50 bg-gradient-to-r from-red-900/30 via-transparent to-transparent p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(255,0,0,0.8)]"></div>
                <h1 className="text-2xl font-bold font-mono text-red-400 tracking-wider">
                  [ UPLOAD MODULE ]
                </h1>
              </div>
              <button
                onClick={() => router.push('/')}
                className="text-red-400/70 hover:text-red-300 font-mono text-sm transition-colors px-3 py-1 border border-red-500/30 hover:border-red-500/50 rounded cursor-pointer"
              >
                ← BACK
              </button>
            </div>
            <div className="mt-2 text-xs text-red-500/60 font-mono tracking-widest">
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
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* 基础信息区域 */}
              <div className="space-y-6">
                <div className="border-l-2 border-red-500/50 pl-4">
                  <label className="block text-red-400 font-mono text-sm mb-3 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1 h-1 bg-red-400 rounded-full"></span>
                    TITLE *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-black/40 border border-red-500/30 text-gray-200 font-mono focus:outline-none focus:border-red-500/60 focus:bg-black/60 transition-all"
                    placeholder="Enter training item title..."
                    required
                  />
                </div>

                <div className="border-l-2 border-red-500/50 pl-4">
                  <label className="block text-red-400 font-mono text-sm mb-3 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1 h-1 bg-red-400 rounded-full"></span>
                    AUDIO FILE *
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                      className="w-full px-4 py-3 bg-black/40 border border-red-500/30 text-gray-300 font-mono focus:outline-none focus:border-red-500/60 focus:bg-black/60 transition-all file:mr-4 file:py-1 file:px-3 file:border-0 file:bg-red-500/20 file:text-red-400 file:font-mono file:text-sm file:cursor-pointer hover:file:bg-red-500/30"
                      required
                    />
                    {audioFile && (
                      <div className="mt-2 text-xs text-red-400/70 font-mono">
                        Selected: {audioFile.name}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 句子分段区域 */}
              <div className="border-t-2 border-red-500/30 pt-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-[2px] w-8 bg-red-500"></div>
                  <h2 className="text-xl font-bold text-red-400 font-mono tracking-wider">SENTENCE SEGMENTS</h2>
                  <div className="flex-1 h-[1px] bg-gradient-to-r from-red-500/50 to-transparent"></div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-500/60 font-mono">COUNT: {sentences.length}</span>
                    {hasUnsavedSentence && (
                      <span className="text-xs text-yellow-400/70 font-mono animate-pulse">(+1 UNSAVED)</span>
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
                              <span className="text-xs text-red-500/70 font-mono">#{index + 1}</span>
                              <p className="font-mono text-gray-200 text-sm">{sentence.text}</p>
                            </div>
                            {sentence.translation && (
                              <p className="text-xs text-gray-400 font-mono mb-2 ml-6">{sentence.translation}</p>
                            )}
                            <p className="text-xs text-red-500/60 font-mono ml-6">
                              TIME: [{sentence.startTime.toFixed(2)}s - {sentence.endTime.toFixed(2)}s]
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveSentence(index)}
                            className="text-red-400/60 hover:text-red-400 ml-4 font-mono text-xs transition-colors px-2 py-1 border border-red-500/30 hover:border-red-500/50 rounded"
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
                    <h3 className="text-red-400 font-mono text-sm uppercase tracking-wider">ADD NEW SEGMENT</h3>
                  </div>

                  <div>
                    <label className="block text-red-400/80 font-mono text-xs mb-2 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-1 h-1 bg-red-400 rounded-full"></span>
                      ENGLISH TEXT *
                    </label>
                    <textarea
                      value={currentSentence.text}
                      onChange={(e) =>
                        setCurrentSentence({ ...currentSentence, text: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-black/40 border border-red-500/30 text-gray-200 font-mono focus:outline-none focus:border-red-500/60 focus:bg-black/60 transition-all resize-none"
                      rows={3}
                      placeholder="Enter English sentence..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-red-400/80 font-mono text-xs mb-2 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-1 h-1 bg-red-400 rounded-full"></span>
                      CHINESE TRANSLATION
                    </label>
                    <input
                      type="text"
                      value={currentSentence.translation}
                      onChange={(e) =>
                        setCurrentSentence({ ...currentSentence, translation: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-black/40 border border-red-500/30 text-gray-200 font-mono focus:outline-none focus:border-red-500/60 focus:bg-black/60 transition-all"
                      placeholder="Enter Chinese translation (optional)..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-red-400/80 font-mono text-xs mb-2 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-1 h-1 bg-red-400 rounded-full"></span>
                        START TIME (S) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={currentSentence.startTime}
                        onChange={(e) =>
                          setCurrentSentence({
                            ...currentSentence,
                            startTime: parseFloat(e.target.value) || 0
                          })
                        }
                        className="w-full px-4 py-3 bg-black/40 border border-red-500/30 text-gray-200 font-mono focus:outline-none focus:border-red-500/60 focus:bg-black/60 transition-all"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-red-400/80 font-mono text-xs mb-2 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-1 h-1 bg-red-400 rounded-full"></span>
                        END TIME (S) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={currentSentence.endTime}
                        onChange={(e) =>
                          setCurrentSentence({
                            ...currentSentence,
                            endTime: parseFloat(e.target.value) || 0
                          })
                        }
                        className="w-full px-4 py-3 bg-black/40 border border-red-500/30 text-gray-200 font-mono focus:outline-none focus:border-red-500/60 focus:bg-black/60 transition-all"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddSentence}
                    className="w-full px-6 py-3 bg-red-500/10 border-2 border-red-500/50 text-red-400 font-mono text-sm uppercase tracking-wider hover:bg-red-500/20 hover:border-red-500/70 hover:text-red-300 transition-all duration-300"
                  >
                    + ADD SEGMENT
                  </button>
                </div>
              </div>

              {/* 底部操作栏 */}
              <div className="flex gap-4 pt-6 border-t-2 border-red-500/30 relative" style={{ zIndex: 100 }}>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="flex-1 px-8 py-4 bg-red-500/20 border-2 border-red-500/60 text-red-400 font-mono text-sm uppercase tracking-wider hover:bg-red-500/30 hover:border-red-500/80 hover:text-red-300 transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-red-500/20 disabled:hover:border-red-500/60 disabled:hover:text-red-400 cursor-pointer relative"
                  style={{ zIndex: 100 }}
                >
                  {isUploading ? '[ UPLOADING... ]' : '[ SUBMIT ]'}
                </button>
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-8 py-4 bg-black/40 border-2 border-gray-600/50 text-gray-400 font-mono text-sm uppercase tracking-wider hover:bg-black/60 hover:border-gray-500/70 hover:text-gray-300 transition-all duration-300 cursor-pointer relative"
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
