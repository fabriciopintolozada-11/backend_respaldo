import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
  hint?: string
}

export function FormField({ label, error, hint, id, ...props }: FieldProps) {
  const errorId = error && id ? `${id}-error` : undefined
  const hintId = hint && id ? `${id}-hint` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        {...props}
      />
      {hint && <span className="field-hint" id={hintId}>{hint}</span>}
      {error && <span className="field-error" id={errorId}>{error}</span>}
    </div>
  )
}

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
  error?: string
  hint?: string
}

export function TextAreaField({ label, error, hint, id, ...props }: TextAreaFieldProps) {
  const errorId = error && id ? `${id}-error` : undefined
  const hintId = hint && id ? `${id}-hint` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        {...props}
      />
      {hint && <span className="field-hint" id={hintId}>{hint}</span>}
      {error && <span className="field-error" id={errorId}>{error}</span>}
    </div>
  )
}
