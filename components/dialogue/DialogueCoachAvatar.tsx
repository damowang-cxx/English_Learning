'use client'

export type DialogueAvatarState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'coach_mode'
export type DialogueAvatarExpression = 'normal' | 'encouraging' | 'confused' | 'corrective'

interface DialogueCoachAvatarProps {
  state: DialogueAvatarState
  expression?: DialogueAvatarExpression
  amplitude?: number
}

export default function DialogueCoachAvatar({
  state,
  expression = 'normal',
  amplitude = 0,
}: DialogueCoachAvatarProps) {
  const mouthScale = state === 'speaking' || state === 'coach_mode'
    ? Math.max(0.22, Math.min(1, amplitude || 0.32))
    : state === 'thinking'
      ? 0.18
      : 0.08

  return (
    <div
      className={`dialogue-avatar dialogue-avatar--${state} dialogue-avatar--${expression}`}
      aria-label="AI dialogue coach avatar"
    >
      <div className="dialogue-avatar__halo" aria-hidden="true" />
      <div className="dialogue-avatar__body">
        <div className="dialogue-avatar__hair" aria-hidden="true" />
        <div className="dialogue-avatar__face">
          <div className="dialogue-avatar__brow dialogue-avatar__brow--left" aria-hidden="true" />
          <div className="dialogue-avatar__brow dialogue-avatar__brow--right" aria-hidden="true" />
          <div className="dialogue-avatar__eye dialogue-avatar__eye--left" aria-hidden="true" />
          <div className="dialogue-avatar__eye dialogue-avatar__eye--right" aria-hidden="true" />
          <div
            className="dialogue-avatar__mouth"
            style={{ transform: `translateX(-50%) scaleY(${mouthScale})` }}
            aria-hidden="true"
          />
        </div>
        <div className="dialogue-avatar__neck" aria-hidden="true" />
        <div className="dialogue-avatar__jacket" aria-hidden="true" />
      </div>
      <div className="dialogue-avatar__status">
        {state === 'listening'
          ? 'LISTENING'
          : state === 'thinking'
            ? 'THINKING'
            : state === 'speaking'
              ? 'SPEAKING'
              : state === 'coach_mode'
                ? 'COACH MODE'
                : 'READY'}
      </div>
    </div>
  )
}
