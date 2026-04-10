export function getUploadFile(formData: FormData, fieldName: string) {
  const value = formData.get(fieldName)

  if (value instanceof File && value.size > 0) {
    return value
  }

  return null
}

export function parseBooleanFormField(formData: FormData, fieldName: string) {
  const rawValue = formData.get(fieldName)
  return rawValue === 'true' || rawValue === '1' || rawValue === 'on'
}
