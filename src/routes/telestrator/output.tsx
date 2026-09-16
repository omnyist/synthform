import { createFileRoute } from '@tanstack/react-router'

import { TelestratorOutput } from '@/components/telestrator/output'

export const Route = createFileRoute('/telestrator/output')({
  component: TelestratorOutput,
})
