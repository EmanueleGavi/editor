import { useEffect, useRef } from 'react'
import BpmnModeler from 'bpmn-js/lib/Modeler'
import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule,
  CamundaPlatformPropertiesProviderModule,
  ZeebePropertiesProviderModule,
} from 'bpmn-js-properties-panel'
import camundaModdle from 'camunda-bpmn-moddle/resources/camunda.json'
import zeebeModdle from 'zeebe-bpmn-moddle/resources/zeebe.json'

import type { EditorHandle } from '../lib/editorHandle'
import { validateBpmnElements, type BpmnElementLike } from '../lib/validation'
import { operatonModdle, flowableModdle } from '../lib/engineModdle'
import { createExecutionPropertiesProvider } from './ExecutionPropertiesProvider'
import { DEFAULT_ENGINE, ENGINES, type EngineId } from '../lib/engines'

import 'bpmn-js/dist/assets/diagram-js.css'
import 'bpmn-js/dist/assets/bpmn-js.css'
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css'
import '@bpmn-io/properties-panel/dist/assets/properties-panel.css'

interface BpmnEditorProps {
  initialXml: string
  engine?: EngineId
  onReady: (handle: EditorHandle) => void
  onChanged: () => void
  onError: (message: string, err: unknown) => void
}

interface CanvasService {
  zoom(value?: number | string): number
  scrollToElement?(element: unknown): void
}

interface ElementRegistry {
  getAll(): BpmnElementLike[]
  get(id: string): unknown
}

function buildEngineSetup(engine: EngineId): {
  additionalModules: Record<string, unknown>[]
  moddleExtensions: Record<string, Record<string, unknown>>
} {
  switch (engine) {
    case 'camunda7':
      return {
        additionalModules: [
          BpmnPropertiesPanelModule,
          BpmnPropertiesProviderModule,
          CamundaPlatformPropertiesProviderModule,
        ],
        moddleExtensions: { camunda: camundaModdle },
      }
    case 'camunda8':
      return {
        additionalModules: [
          BpmnPropertiesPanelModule,
          BpmnPropertiesProviderModule,
          ZeebePropertiesProviderModule,
        ],
        moddleExtensions: { zeebe: zeebeModdle },
      }
    case 'operaton':
      return {
        additionalModules: [
          BpmnPropertiesPanelModule,
          BpmnPropertiesProviderModule,
          createExecutionPropertiesProvider('operaton', 'Operaton'),
        ],
        moddleExtensions: { operaton: operatonModdle },
      }
    case 'flowable':
      return {
        additionalModules: [
          BpmnPropertiesPanelModule,
          BpmnPropertiesProviderModule,
          createExecutionPropertiesProvider('flowable', 'Flowable'),
        ],
        moddleExtensions: { flowable: flowableModdle },
      }
    case 'none':
    default:
      return {
        additionalModules: [BpmnPropertiesPanelModule, BpmnPropertiesProviderModule],
        moddleExtensions: {},
      }
  }
}

export default function BpmnEditor({
  initialXml,
  engine = DEFAULT_ENGINE,
  onReady,
  onChanged,
  onError,
}: BpmnEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const callbacksRef = useRef({ onReady, onChanged, onError })
  callbacksRef.current = { onReady, onChanged, onError }

  useEffect(() => {
    const { additionalModules, moddleExtensions } = buildEngineSetup(engine)
    const modeler = new BpmnModeler({
      container: containerRef.current!,
      keyboard: { bindTo: document },
      propertiesPanel: { parent: panelRef.current! },
      additionalModules,
      moddleExtensions,
    })
    modeler.on('commandStack.changed', () => callbacksRef.current.onChanged())

    let cancelled = false
    modeler
      .importXML(initialXml)
      .then(() => {
        if (cancelled) return
        modeler.get<CanvasService>('canvas').zoom('fit-viewport')
        const commandStack = modeler.get<{ undo(): void; redo(): void }>('commandStack')
        const registry = modeler.get<ElementRegistry>('elementRegistry')
        callbacksRef.current.onReady({
          getContent: async () => {
            const { xml } = await modeler.saveXML({ format: true })
            return xml!
          },
          getSvg: async () => {
            const { svg } = await modeler.saveSVG()
            return svg
          },
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
          validate: () => validateBpmnElements(registry.getAll()),
          selectElement: (id) => {
            const element = registry.get(id)
            if (!element) return
            modeler.get<{ select(el: unknown): void }>('selection').select(element)
            try {
              modeler.get<CanvasService>('canvas').scrollToElement?.(element)
            } catch {
              /* older diagram-js without scrollToElement */
            }
          },
        })
      })
      .catch((err: unknown) => {
        if (!cancelled) callbacksRef.current.onError('Failed to load BPMN diagram', err)
      })

    return () => {
      cancelled = true
      modeler.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine])

  return (
    <div className="editor-canvas editor-split">
      <div ref={containerRef} className="bpmn-editor bpe-canvas" />
      <div ref={panelRef} className="bpe-props" />
      <div className="engine-badge" title="Target workflow engine">
        {ENGINES.find((e) => e.id === engine)?.label}
      </div>
    </div>
  )
}
