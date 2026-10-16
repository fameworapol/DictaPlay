export interface ExerciseFormInput {
  title: string
  transcript: string
  audioBlobId: string | null
}

export interface FieldError {
  field: 'title' | 'transcript' | 'audio'
  message: string
}

export function validateExerciseInput(input: ExerciseFormInput): FieldError[] {
  const errors: FieldError[] = []
  if (!input.title.trim()) errors.push({ field: 'title', message: 'Title is required.' })
  if (!input.transcript.trim()) errors.push({ field: 'transcript', message: 'Transcript is required.' })
  if (!input.audioBlobId) errors.push({ field: 'audio', message: 'Audio is required.' })
  return errors
}
