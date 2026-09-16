import type { Issue } from './validation'

/** Common imperative interface every diagram editor exposes to the app shell. */
export interface EditorHandle {
  /** Serialized document: BPMN/CMMN XML or flow JSON. */
  getContent(): Promise<string>
  /** Standalone SVG of the current diagram, for SVG/PNG/PDF export. */
  getSvg(): Promise<string>
  zoomIn(): void
  zoomOut(): void
  zoomFit(): void
  /** Null when the editor has no command history (flow editors, for now). */
  undo: (() => void) | null
  redo: (() => void) | null
  /** Null when validation is not supported (CMMN, for now). */
  validate: (() => Issue[]) | null
  /** Select (and reveal) a diagram element, e.g. from a validation issue. */
  selectElement(id: string): void
}
