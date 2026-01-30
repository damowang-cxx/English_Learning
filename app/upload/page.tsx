'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
    if (currentSentence.text.trim()) {
      setSentences([...sentences, { ...currentSentence }])
      setCurrentSentence({
        text: '',
        translation: '',
        startTime: currentSentence.endTime,
        endTime: currentSentence.endTime
      })
    }
  }

  const handleRemoveSentence = (index: number) => {
    setSentences(sentences.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !audioFile || sentences.length === 0) {
      alert('请填写所有必填项')
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('title', title)
      formData.append('audio', audioFile)
      formData.append('sentences', JSON.stringify(sentences))

      const response = await fetch('/api/training-items', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('上传失败')
      }

      const data = await response.json()
      router.push(`/training/${data.id}`)
    } catch (error) {
      console.error('Upload error:', error)
      alert('上传失败，请重试')
    } finally {
      setIsUploading(false)
    }
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
              [ 上传训练条目 ]
            </h1>
            <p className="text-gray-500 text-sm font-mono opacity-70">UPLOAD TRAINING ITEM</p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-8 rounded-lg" style={{
            background: 'rgba(232, 244, 255, 0.02)',
            border: '1px solid rgba(232, 244, 255, 0.08)',
            backdropFilter: 'blur(6px)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(232, 244, 255, 0.05)'
          }}>
            <div>
              <label className="block text-gray-300 font-mono text-sm mb-3 uppercase tracking-wider">
                标题 *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="cyber-input w-full font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-gray-300 font-mono text-sm mb-3 uppercase tracking-wider">
                音频文件 *
              </label>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                className="cyber-input w-full font-mono text-gray-300"
                required
              />
            </div>

            <div className="border-t border-gray-700/15 pt-8">
              <h2 className="text-2xl font-bold text-gray-200 mb-6 font-mono">[ 句子分段 ]</h2>

              <div className="space-y-4 mb-6">
                {sentences.map((sentence, index) => (
                  <div
                    key={index}
                    className="p-4 flex justify-between items-start rounded-md"
                    style={{
                      background: 'rgba(232, 244, 255, 0.01)',
                      border: '1px solid rgba(232, 244, 255, 0.06)',
                      backdropFilter: 'blur(2px)',
                      boxShadow: 'inset 0 1px 1px rgba(232, 244, 255, 0.02)'
                    }}
                  >
                    <div className="flex-1">
                      <p className="font-mono text-gray-200 mb-2">{sentence.text}</p>
                      <p className="text-sm text-gray-300 font-mono mb-1">{sentence.translation}</p>
                      <p className="text-xs text-gray-500 font-mono">
                        [{sentence.startTime.toFixed(2)}s - {sentence.endTime.toFixed(2)}s]
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveSentence(index)}
                      className="text-red-400/70 hover:text-red-400 ml-4 font-mono text-sm transition-colors"
                    >
                      [删除]
                    </button>
                  </div>
                ))}
              </div>

              <div className="p-6 space-y-6 rounded-md" style={{
                background: 'rgba(232, 244, 255, 0.015)',
                border: '1px solid rgba(232, 244, 255, 0.06)',
                backdropFilter: 'blur(3px)',
                boxShadow: 'inset 0 1px 2px rgba(232, 244, 255, 0.03)'
              }}>
                <div>
                  <label className="block text-gray-300 font-mono text-sm mb-3 uppercase tracking-wider">
                    英语句子 *
                  </label>
                  <textarea
                    value={currentSentence.text}
                    onChange={(e) =>
                      setCurrentSentence({ ...currentSentence, text: e.target.value })
                    }
                    className="cyber-input w-full font-mono"
                    rows={3}
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-300 font-mono text-sm mb-3 uppercase tracking-wider">
                    中文翻译
                  </label>
                  <input
                    type="text"
                    value={currentSentence.translation}
                    onChange={(e) =>
                      setCurrentSentence({ ...currentSentence, translation: e.target.value })
                    }
                    className="cyber-input w-full font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-300 font-mono text-sm mb-3 uppercase tracking-wider">
                      开始时间（秒）*
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
                      className="cyber-input w-full font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-gray-300 font-mono text-sm mb-3 uppercase tracking-wider">
                      结束时间（秒）*
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
                      className="cyber-input w-full font-mono"
                      required
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddSentence}
                  className="w-full px-4 py-2 font-mono text-sm uppercase tracking-wider border border-gray-500/30 text-gray-300 hover:text-gray-200 hover:border-gray-400/40 transition-all duration-300 bg-gray-800/20 hover:bg-gray-800/30 backdrop-blur-sm"
                >
                  + 添加句子
                </button>
              </div>
            </div>

            <div className="flex gap-4 pt-6 border-t border-gray-700/15">
              <button
                type="submit"
                disabled={isUploading}
                className="flex-1 px-6 py-3 font-mono text-sm uppercase tracking-wider border border-gray-500/30 text-gray-300 hover:text-gray-200 hover:border-gray-400/40 transition-all duration-300 bg-gray-800/20 hover:bg-gray-800/30 backdrop-blur-sm disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isUploading ? '[ 上传中... ]' : '[ 提交 ]'}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="px-8 py-3 font-mono text-sm uppercase tracking-wider border border-gray-500/30 text-gray-300 hover:text-gray-200 hover:border-gray-400/40 transition-all duration-300 bg-gray-800/20 hover:bg-gray-800/30 backdrop-blur-sm"
              >
                [ 取消 ]
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
