/** Mirrors the backend: extractors for these formats, MAX_UPLOAD_MB defaults to 10. */
export const ACCEPTED_EXTENSIONS = ["pdf", "docx", "txt", "md"] as const
export const ACCEPT_ATTRIBUTE = ".pdf,.docx,.txt,.md"
export const MAX_UPLOAD_MB = 10

export function validateUpload(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? ""
  if (!ACCEPTED_EXTENSIONS.includes(extension as (typeof ACCEPTED_EXTENSIONS)[number])) {
    return `Only PDF, DOCX, TXT and MD files can be read. “${file.name}” is not one of them.`
  }
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    return `The file is larger than the ${MAX_UPLOAD_MB} MB limit.`
  }
  return null
}
