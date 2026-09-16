import { createFileRoute } from '@tanstack/react-router'

import { TelestratorInput } from '@/components/telestrator/input'

export const Route = createFileRoute('/telestrator/')({
  component: TelestratorInput,
})
