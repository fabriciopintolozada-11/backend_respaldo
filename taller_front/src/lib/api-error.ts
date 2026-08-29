export type ApiErrorBody = {
  statusCode?: number
  message?: string | string[]
  error?: string
}

export class ApiError extends Error {
  readonly status: number
  readonly details: string[]

  constructor(status: number, body?: ApiErrorBody) {
    const details = Array.isArray(body?.message)
      ? body.message
      : body?.message
        ? [body.message]
        : []

    super(details[0] || defaultMessage(status))
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

function defaultMessage(status: number) {
  if (status === 0) return 'No fue posible conectar con el servidor.'
  if (status === 401) return 'La sesión de recepción no está configurada.'
  if (status === 403) return 'No tienes permisos de recepcionista.'
  if (status === 409) return 'El vehículo no puede ser recibido.'
  if (status >= 500) return 'El servidor no pudo procesar la solicitud.'
  return 'No fue posible completar la solicitud.'
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado.'
}
