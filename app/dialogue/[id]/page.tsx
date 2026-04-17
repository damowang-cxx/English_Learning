import DialoguePracticeClient from '@/components/dialogue/DialoguePracticeClient'

interface DialoguePracticePageProps {
  params: Promise<{ id: string }>
}

export default async function DialoguePracticePage({ params }: DialoguePracticePageProps) {
  const { id } = await params

  return <DialoguePracticeClient scenarioId={id} />
}
