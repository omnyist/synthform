import { createFileRoute } from '@tanstack/react-router'

import { AlertAudioDriver } from '@/components/shared/alert-audio-driver'

function AudioOnly() {
  return <AlertAudioDriver soundEnabled={true} />
}

export const Route = createFileRoute('/audio')({
  component: AudioOnly,
})
