import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import { useEntitlements } from '../hooks/useEntitlements'
import { UpgradeModal } from '../components/UpgradeModal'

/**
 * Mappa tra chiavi usate nell'editor e feature del piano.
 * Se una chiave non è presente, la funzionalità è sempre permessa.
 */
const REQUIRED_FEATURE: Record<string, string | null> = {
  bpmn: 'editor.bpmn',
  cmmn: 'editor.cmmn',
  flowchart: 'editor.flowchart',
  workflow: 'editor.workflow',
  pdf: 'export.pdf',
}

type GateFn = (key: string) => boolean

const EditorGatingContext = createContext<GateFn>(() => true)

export function EditorGatingProvider({ children }: { children: ReactNode }) {
  const { can } = useEntitlements()
  const [upgradeFeature, setUpgradeFeature] = useState<string | null>(null)

  const gate = useCallback<GateFn>(
    (key) => {
      const required = REQUIRED_FEATURE[key]
      if (!required) return true
      if (can(required)) return true
      setUpgradeFeature(required)
      return false
    },
    [can],
  )

  return (
    <EditorGatingContext.Provider value={gate}>
      {children}
      <UpgradeModal
        open={upgradeFeature !== null}
        feature={upgradeFeature ?? undefined}
        onClose={() => setUpgradeFeature(null)}
      />
    </EditorGatingContext.Provider>
  )
}

export function useEditorGating(): GateFn {
  return useContext(EditorGatingContext)
}