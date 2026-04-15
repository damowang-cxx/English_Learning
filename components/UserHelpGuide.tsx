'use client'

import { X } from 'lucide-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface UserHelpGuideProps {
  isOpen: boolean
  isSeen: boolean
  isMarkingSeen: boolean
  errorMessage: string | null
  onClose: () => void
  onMarkSeen: () => void
}

const GUIDE_SECTIONS = [
  {
    label: 'QUICK START',
    title: '快速开始',
    body: '选择 LISTENING 或 VIDEO，打开训练内容。使用 MENU 快速切换条目、返回列表或进入不同训练区域。',
  },
  {
    label: 'LISTENING',
    title: '听力训练',
    body: '播放音频，按句子跳转和重复。可以切换翻译、进行听写、进入专注模式，并把生词保存到词库。',
  },
  {
    label: 'VIDEO',
    title: '视频训练',
    body: '播放视频并跟随字幕列表。可以按角色筛选字幕，保存字幕生词，也可以记录短语笔记。',
  },
  {
    label: 'GLOBAL VOCAB',
    title: '全局词库',
    body: '训练页保存的生词会汇总到 GLOBAL VOCAB，方便集中复习、整理和导出。',
  },
  {
    label: 'PERMISSION',
    title: '权限说明',
    body: '普通用户可以学习、记录、管理自己的头像和笔记。上传、编辑、删除训练数据仅管理员可用。',
  },
]

const SHORTCUTS = [
  { key: 'Space', description: '播放或暂停当前音频、视频。' },
  { key: 'ArrowUp / ArrowDown', description: '听力页切换上一句或下一句。' },
  { key: 'R', description: '听力页重复当前句。' },
  { key: 'T', description: '听力页切换全部翻译。' },
  { key: 'D', description: '听力页切换当前句翻译。' },
  { key: 'Ctrl+I', description: '听写输入中显示首字母提示。' },
  { key: 'Ctrl+L', description: '听写输入中显示完整单词。' },
  { key: 'Esc', description: '退出视频窗口全屏，或关闭当前弹窗。' },
]

export default function UserHelpGuide({
  isOpen,
  isSeen,
  isMarkingSeen,
  errorMessage,
  onClose,
  onMarkSeen,
}: UserHelpGuideProps) {
  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      onClose()
    }

    window.addEventListener('keydown', handleKeyDown, true)

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [isOpen, onClose])

  if (!isOpen || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-[320] flex items-center justify-center px-4 py-5 pointer-events-auto">
      <button
        type="button"
        aria-label="Close help guide"
        className="absolute inset-0 bg-black/58 backdrop-blur-[3px]"
        onClick={onClose}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-help-guide-title"
        className="relative z-10 flex max-h-[min(92vh,760px)] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-cyan-400/42 bg-[linear-gradient(160deg,rgba(3,15,18,0.97),rgba(4,8,15,0.96)_52%,rgba(11,8,18,0.95))] shadow-[0_0_48px_rgba(34,211,238,0.2),inset_0_0_28px_rgba(34,211,238,0.07)]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(34,211,238,0.045)_50%,transparent_100%)] bg-[length:100%_5px] opacity-55" />
        <div className="pointer-events-none absolute left-0 top-0 h-14 w-14 border-l border-t border-cyan-300/55" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-14 w-14 border-b border-r border-fuchsia-300/45" />

        <div className="relative z-10 flex items-start justify-between gap-4 border-b border-cyan-500/18 px-5 py-4">
          <div>
            <div className="text-[10px] cyber-label tracking-[0.28em] text-cyan-300/70">
              USER GUIDE {isSeen ? '' : '/ NEW'}
            </div>
            <h2 id="user-help-guide-title" className="mt-2 text-2xl cyber-title text-cyan-50">
              HELP
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-cyan-50/72">
              常用入口、训练方式和快捷键都在这里。关闭按钮只收起窗口，点击 GOT IT 后才会清除 NEW 提示。
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-cyan-500/30 bg-black/24 text-cyan-200/75 transition-colors hover:border-cyan-300/60 hover:text-cyan-50"
            aria-label="Close help guide"
          >
            <X size={18} />
          </button>
        </div>

        <div className="relative z-10 overflow-y-auto px-5 py-5 [scrollbar-color:rgba(34,211,238,0.55)_rgba(8,15,20,0.72)] [scrollbar-width:thin]">
          <div className="grid gap-3 md:grid-cols-2">
            {GUIDE_SECTIONS.map((section) => (
              <article
                key={section.label}
                className="rounded-md border border-cyan-500/18 bg-cyan-500/[0.045] p-4"
              >
                <div className="text-[10px] cyber-label tracking-[0.22em] text-cyan-300/65">{section.label}</div>
                <h3 className="mt-2 text-base cyber-title text-cyan-50">{section.title}</h3>
                <p className="mt-2 text-sm leading-6 text-cyan-50/70">{section.body}</p>
              </article>
            ))}
          </div>

          <div className="mt-5 rounded-md border border-fuchsia-400/20 bg-fuchsia-500/[0.04] p-4">
            <div className="text-[10px] cyber-label tracking-[0.22em] text-fuchsia-200/70">SHORTCUTS</div>
            <h3 className="mt-2 text-base cyber-title text-fuchsia-50">快捷键</h3>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              {SHORTCUTS.map((shortcut) => (
                <div key={shortcut.key} className="flex items-start gap-3 text-sm leading-6 text-fuchsia-50/72">
                  <dt className="min-w-[8rem] shrink-0">
                    <kbd className="inline-flex rounded border border-fuchsia-300/32 bg-black/28 px-2 py-0.5 font-mono text-[11px] text-fuchsia-100">
                      {shortcut.key}
                    </kbd>
                  </dt>
                  <dd>{shortcut.description}</dd>
                </div>
              ))}
            </dl>
          </div>

          {errorMessage ? (
            <p className="mt-4 rounded-md border border-red-400/30 bg-red-500/[0.08] px-3 py-2 text-sm leading-6 text-red-100/80">
              {errorMessage}
            </p>
          ) : null}
        </div>

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-t border-cyan-500/18 px-5 py-4">
          <p className="text-xs leading-5 text-cyan-50/55">Esc 或关闭按钮不会标记已读。</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-cyan-500/28 bg-black/25 px-4 py-2 text-xs font-mono tracking-[0.16em] text-cyan-200/75 transition-colors hover:border-cyan-300/55 hover:text-cyan-50"
            >
              CLOSE
            </button>
            <button
              type="button"
              onClick={onMarkSeen}
              disabled={isMarkingSeen}
              className="rounded-md border border-emerald-300/42 bg-emerald-400/[0.12] px-4 py-2 text-xs font-mono tracking-[0.16em] text-emerald-100 transition-colors hover:border-emerald-200/70 hover:bg-emerald-400/[0.18] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {isMarkingSeen ? 'SAVING...' : 'GOT IT'}
            </button>
          </div>
        </div>
      </section>
    </div>,
    document.body
  )
}
