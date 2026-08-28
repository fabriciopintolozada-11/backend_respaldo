import { Wrench } from 'lucide-react'

interface LoadingSpinnerProps {
  message?: string
}

export function LoadingSpinner({ message = 'Cargando...' }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="relative">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-border border-t-primary" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Wrench className="h-5 w-5 text-primary" />
        </div>
      </div>
      <p className="text-sm text-muted-foreground font-medium">{message}</p>
    </div>
  )
}
