import type { DownloadedFile } from "@/api/client"

/** Hands a downloaded file to the browser and releases the object URL again. */
export function saveBlob({ blob, filename }: DownloadedFile): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
