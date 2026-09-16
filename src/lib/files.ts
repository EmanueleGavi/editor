// File open/save helpers. Uses the File System Access API when available
// (Chrome/Edge, and Tauri's webview) and falls back to <input>/<a> downloads.

export interface OpenedFile {
  name: string
  content: string
  handle: FileSystemFileHandle | null
}

export interface FilePickerType {
  description: string
  accept: Record<string, string[]>
}

declare global {
  interface Window {
    showOpenFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle[]>
    showSaveFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle>
  }
}

export async function openFile(
  accept: string,
  pickerTypes: FilePickerType[],
): Promise<OpenedFile | null> {
  if (window.showOpenFilePicker) {
    try {
      const [handle] = await window.showOpenFilePicker({ types: pickerTypes })
      const file = await handle.getFile()
      return { name: file.name, content: await file.text(), handle }
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return null
      throw err
    }
  }
  // Fallback: hidden <input type="file">
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      resolve({ name: file.name, content: await file.text(), handle: null })
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}

/** Save to an existing handle. Returns false if no handle is available. */
export async function saveToHandle(
  handle: FileSystemFileHandle | null,
  content: string,
): Promise<boolean> {
  if (!handle) return false
  const writable = await handle.createWritable()
  await writable.write(content)
  await writable.close()
  return true
}

/** "Save as": prompts for a location, returns the new handle (null if cancelled). */
export async function saveAs(
  suggestedName: string,
  content: string,
  pickerTypes: FilePickerType[],
): Promise<FileSystemFileHandle | null | 'downloaded'> {
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({ suggestedName, types: pickerTypes })
      await saveToHandle(handle, content)
      return handle
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return null
      throw err
    }
  }
  downloadBlob(new Blob([content], { type: 'text/plain' }), suggestedName)
  return 'downloaded'
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
