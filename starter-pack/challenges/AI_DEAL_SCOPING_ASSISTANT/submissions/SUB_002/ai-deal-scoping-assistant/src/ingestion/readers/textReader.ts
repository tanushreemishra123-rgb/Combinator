/** Reads a plain-text or Markdown file through the browser's File API. */
export async function readTextFile(file: File): Promise<string> {
  return file.text();
}
