import { useEffect, useRef } from 'react'
import CmmnModeler from 'cmmn-js/lib/Modeler'
import type { EditorHandle } from '../lib/editorHandle'

import 'cmmn-js/dist/assets/diagram-js.css'
import 'cmmn-js/dist/assets/cmmn-font/css/cmmn-embedded.css'

interface CmmnEditorProps {
  initialXml: string
  onReady: (handle: EditorHandle) => void
  onChanged: () => void
  onError: (message: string, err: unknown) => void
}

interface CanvasService {
  zoom(value?: number | string): number
}

export default function CmmnEditor({ initialXml, onReady, onChanged, onError }: CmmnEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const callbacksRef = useRef({ onReady, onChanged, onError })
  callbacksRef.current = { onReady, onChanged, onError }

  useEffect(() => {
    const modeler = new CmmnModeler({
      container: containerRef.current!,
      keyboard: { bindTo: document },
    })
    modeler.on('commandStack.changed', () => callbacksRef.current.onChanged())

    let cancelled = false
    // cmmn-js still uses node-style callbacks (it predates the promise API)
    modeler.importXML(initialXml, (err?: Error) => {
      if (cancelled) return
      if (err) {
        callbacksRef.current.onError('Failed to load CMMN diagram', err)
        return
      }
      modeler.get<CanvasService>('canvas').zoom('fit-viewport')
      const commandStack = modeler.get<{ undo(): void; redo(): void }>('commandStack')
      callbacksRef.current.onReady({
        getContent: () =>
          new Promise<string>((resolve, reject) => {
            modeler.saveXML({ format: true }, (saveErr, xml) =>
              saveErr || !xml ? reject(saveErr ?? new Error('Empty XML')) : resolve(xml),
            )
          }),
        getSvg: () =>
          new Promise<string>((resolve, reject) => {
            modeler.saveSVG((saveErr, svg) =>
              saveErr || !svg ? reject(saveErr ?? new Error('Empty SVG')) : resolve(svg),
            )
          }),
        zoomIn: () => {
          const canvas = modeler.get<CanvasService>('canvas')
          canvas.zoom(canvas.zoom() * 1.2)
        },
        zoomOut: () => {
          const canvas = modeler.get<CanvasService>('canvas')
          canvas.zoom(canvas.zoom() / 1.2)
        },
        zoomFit: () => modeler.get<CanvasService>('canvas').zoom('fit-viewport'),
        undo: () => commandStack.undo(),
        redo: () => commandStack.redo(),
        validate: null,
        selectElement: () => {},
      })
    })

    return () => {
      cancelled = true
      modeler.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={containerRef} className="editor-canvas cmmn-editor" />
}
