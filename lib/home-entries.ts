export type HomeEntry =
  | {
      kind: 'listening'
      id: string
      title: string
      meta: {
        createdAt: string
        sentencesCount: number
      }
    }
  | {
      kind: 'video'
      id: string
      title: string
      coverUrl: string | null
      coverPositionX: number
      coverPositionY: number
      meta: {
        createdAt: string
        captionsCount: number
        tag: string
      }
    }
