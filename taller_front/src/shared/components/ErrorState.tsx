import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/shared/components/Button'

interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

export function ErrorState({ message = 'Ocurrio un error al cargar los datos.', onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="w-12 h-12 rounded-xl bg-danger/15 border border-danger/30 flex items-center justify-center">
        <AlertTriangle className="h-6 w-6 text-danger" />
      </div>
      <h3 className="text-sm font-bold text-foreground">Error</h3>
      <p className="text-xs text-muted-foreground max-w-md">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>
          Reintentar
        </Button>
      )}
    </div>
  )
}
