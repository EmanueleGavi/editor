import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  ClipboardList,
  Cpu,
  Download,
  FileImage,
  FilePlus2,
  FileText,
  FolderOpen,
  GitFork,
  Maximize,
  Network,
  Redo2,
  Save,
  Shapes,
  Undo2,
  Workflow as WorkflowIcon,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

import BpmnEditor from './components/BpmnEditor'
import CmmnEditor from './components/CmmnEditor'
import FlowEditor from './components/FlowEditor'
import type { EditorHandle } from './lib/editorHandle'
import {
  DOC_TYPES,
  OPEN_ACCEPT,
  OPEN_PICKER_TYPES,
  detectDocType,
  stripKnownExtension,
  type DocType,
} from './lib/docTypes'
import { openFile, saveAs, saveToHandle } from './lib/files'
import { exportPdf, exportPng, exportSvg } from './lib/export'
import type { Issue } from './lib/validation'
import { DEFAULT_ENGINE, ENGINES, type EngineId } from './lib/engines'

type UiMode = 'simple' | 'advanced'
type MenuName = 'new' | 'export' | 'engine' | null

interface Toast {
  id: number
  text: string
  kind: 'success' | 'error'
}

const NEW_MENU: { type: DocType; icon: React.ReactNode; description: string }[] = [
  { type: 'bpmn', icon: <Network size={16} />, description: 'Standard BPMN 2.0 process' },
  { type: 'cmmn', icon: <ClipboardList size={16} />, description: 'CMMN 1.1 case model' },
  { type: 'flowchart', icon: <GitFork size={16} />, description: 'Free-form flowchart' },
  { type: 'workflow', icon: <WorkflowIcon size={16} />, description: 'Executable state workflow' },
]

let toastCounter = 0

export default function App() {
  const handleRef = useRef<EditorHandle | null>(null)
  const fileHandleRef = useRef<FileSystemFileHandle | null>(null)

  const [docType, setDocType] = useState<DocType>('bpmn')
  const [docKey, setDocKey] = useState(1)
  const [initialContent, setInitialContent] = useState(() => DOC_TYPES.bpmn.newContent())
  const [fileName, setFileName] = useState(DOC_TYPES.bpmn.defaultFileName)
  const [renaming, setRenaming] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState('Ready')
  const [openMenu, setOpenMenu] = useState<MenuName>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [issues, setIssues] = useState<Issue[] | null>(null)
  const [issuesOpen, setIssuesOpen] = useState(false)
  const [changeTick, setChangeTick] = useState(0)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [mode, setMode] = useState<UiMode>(
    () => (localStorage.getItem('editor-mode') as UiMode) || 'simple',
  )
  const [engine, setEngine] = useState<EngineId>(
    () => (localStorage.getItem('bpmn-engine') as EngineId) || DEFAULT_ENGINE,
  )

  useEffect(() => {
    localStorage.setItem('editor-mode', mode)
  }, [mode])

  useEffect(() => {
    localStorage.setItem('bpmn-engine', engine)
  }, [engine])

  const pushToast = useCallback((text: string, kind: Toast['kind'] = 'success') => {
    const id = ++toastCounter
    setToasts((current) => [...current, { id, text, kind }])
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 2800)
  }, [])

  const report = useCallback(
    (message: string, options?: { toast?: boolean }) => {
      setStatus(message)
      if (options?.toast !== false) pushToast(message)
    },
    [pushToast],
  )

  const reportError = useCallback(
    (message: string, err: unknown) => {
      console.error(err)
      const detail = err instanceof Error ? err.message : String(err)
      setStatus(`${message}: ${detail}`)
      pushToast(message, 'error')
    },
    [pushToast],
  )

  // Re-validate (debounced) after every model change
  useEffect(() => {
    const timer = setTimeout(() => {
      const handle = handleRef.current
      if (!handle) return
      setIssues(handle.validate ? handle.validate() : null)
    }, 600)
    return () => clearTimeout(timer)
  }, [changeTick, docKey])

  // Close dropdown menus on any outside click
  useEffect(() => {
    if (!openMenu) return
    const close = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest('.menu')) setOpenMenu(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [openMenu])

  const confirmDiscard = useCallback(() => {
    return !dirty || window.confirm('You have unsaved changes. Discard them?')
  }, [dirty])

  const loadDocument = useCallback(
    (type: DocType, content: string, name: string, handle: FileSystemFileHandle | null) => {
      handleRef.current = null
      fileHandleRef.current = handle
      setCanUndo(false)
      setIssues(null)
      setIssuesOpen(false)
      setDocType(type)
      setInitialContent(content)
      setFileName(name)
      setDirty(false)
      setDocKey((k) => k + 1)
    },
    [],
  )

  const handleNew = useCallback(
    (type: DocType) => {
      setOpenMenu(null)
      if (!confirmDiscard()) return
      loadDocument(type, DOC_TYPES[type].newContent(), DOC_TYPES[type].defaultFileName, null)
      report(`New ${DOC_TYPES[type].label.toLowerCase()} created`)
    },
    [confirmDiscard, loadDocument, report],
  )

  const handleOpen = useCallback(async () => {
    if (!confirmDiscard()) return
    try {
      const file = await openFile(OPEN_ACCEPT, OPEN_PICKER_TYPES)
      if (!file) return
      const type = detectDocType(file.name, file.content)
      if (!type) {
        reportError('Failed to open file', new Error('Unrecognized document format'))
        return
      }
      loadDocument(type, file.content, file.name, file.handle)
      report(`Opened ${file.name}`)
    } catch (err) {
      reportError('Failed to open file', err)
    }
  }, [confirmDiscard, loadDocument, report, reportError])

  const handleSaveAs = useCallback(async () => {
    try {
      const content = await handleRef.current!.getContent()
      const result = await saveAs(fileName, content, DOC_TYPES[docType].pickerTypes)
      if (result === null) return
      if (result !== 'downloaded') {
        fileHandleRef.current = result
        setFileName(result.name)
      }
      setDirty(false)
      report('Saved')
    } catch (err) {
      reportError('Failed to save', err)
    }
  }, [docType, fileName, report, reportError])

  const handleSave = useCallback(async () => {
    try {
      const content = await handleRef.current!.getContent()
      if (await saveToHandle(fileHandleRef.current, content)) {
        setDirty(false)
        report(`Saved ${fileName}`)
      } else {
        await handleSaveAs()
      }
    } catch (err) {
      reportError('Failed to save', err)
    }
  }, [fileName, handleSaveAs, report, reportError])

  const handleEngineChange = useCallback(
    async (newEngine: EngineId) => {
      setOpenMenu(null)
      if (newEngine === engine) return
      try {
        if (docType === 'bpmn' && handleRef.current) {
          const content = await handleRef.current.getContent()
          setInitialContent(content)
        }
      } catch (err) {
        reportError('Failed to switch engine', err)
        return
      }
      setEngine(newEngine)
      setDocKey((k) => k + 1)
      report(`Target engine: ${ENGINES.find((e) => e.id === newEngine)?.label}`)
    },
    [docType, engine, report, reportError],
  )

  const handleExport = useCallback(
    async (format: 'svg' | 'png' | 'pdf') => {
      setOpenMenu(null)
      try {
        const svg = await handleRef.current!.getSvg()
        const baseName = stripKnownExtension(fileName)
        if (format === 'svg') exportSvg(svg, baseName)
        else if (format === 'png') await exportPng(svg, baseName)
        else await exportPdf(svg, baseName)
        report(`Exported as ${format.toUpperCase()}`)
      } catch (err) {
        reportError(`Failed to export ${format.toUpperCase()}`, err)
      }
    },
    [fileName, report, reportError],
  )

  // Keyboard shortcuts: Ctrl+S save, Ctrl+Shift+S save as, Ctrl+O open
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      const key = event.key.toLowerCase()
      if (key === 's') {
        event.preventDefault()
        if (event.shiftKey) void handleSaveAs()
        else void handleSave()
      } else if (key === 'o') {
        event.preventDefault()
        void handleOpen()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [handleOpen, handleSave, handleSaveAs])

  const editorProps = {
    onChanged: () => {
      setDirty(true)
      setChangeTick((t) => t + 1)
    },
    onError: reportError,
    onReady: (handle: EditorHandle) => {
      handleRef.current = handle
      setCanUndo(handle.undo !== null)
      setIssues(handle.validate ? handle.validate() : null)
    },
  }

  const errorCount = issues?.filter((i) => i.severity === 'error').length ?? 0
  const warningCount = issues?.filter((i) => i.severity === 'warning').length ?? 0

  const commitRename = (value: string) => {
    setRenaming(false)
    const trimmed = value.trim()
    if (trimmed && trimmed !== fileName) {
      setFileName(trimmed)
      setDirty(true)
    }
  }

  return (
    <div className={`app ${mode}`}>
      <div className="toolbar">
        <div className="brand" title="Process Editor">
          <span className="brand-mark">
            <Shapes size={17} />
          </span>
          <span className="brand-name">Process Editor</span>
        </div>

        <div className="group">
          <div className="menu">
            <button className="btn" onClick={() => setOpenMenu(openMenu === 'new' ? null : 'new')}>
              <FilePlus2 size={15} />
              <span className="btn-label">New</span>
              <ChevronDown size={13} className="chev" />
            </button>
            {openMenu === 'new' && (
              <div className="menu-items">
                {NEW_MENU.map((entry) => (
                  <button key={entry.type} onClick={() => handleNew(entry.type)}>
                    <span className="mi-icon">{entry.icon}</span>
                    <span className="mi-text">
                      <strong>{DOC_TYPES[entry.type].label}</strong>
                      <small>{entry.description}</small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="btn" onClick={handleOpen} title="Open… (Ctrl+O)">
            <FolderOpen size={15} />
            <span className="btn-label">Open</span>
          </button>
          <button className="btn primary" onClick={handleSave} title="Save (Ctrl+S)">
            <Save size={15} />
            <span className="btn-label">Save</span>
          </button>
          <div className="menu">
            <button
              className="btn"
              onClick={() => setOpenMenu(openMenu === 'export' ? null : 'export')}
            >
              <Download size={15} />
              <span className="btn-label">Export</span>
              <ChevronDown size={13} className="chev" />
            </button>
            {openMenu === 'export' && (
              <div className="menu-items">
                <button onClick={() => handleExport('pdf')}>
                  <span className="mi-icon"><FileText size={16} /></span>
                  <span className="mi-text"><strong>PDF</strong><small>Vector, print-ready</small></span>
                </button>
                <button onClick={() => handleExport('png')}>
                  <span className="mi-icon"><FileImage size={16} /></span>
                  <span className="mi-text"><strong>PNG</strong><small>Raster image, 2× scale</small></span>
                </button>
                <button onClick={() => handleExport('svg')}>
                  <span className="mi-icon"><Shapes size={16} /></span>
                  <span className="mi-text"><strong>SVG</strong><small>Editable vector graphics</small></span>
                </button>
              </div>
            )}
          </div>

          {docType === 'bpmn' && (
            <div className="menu">
              <button
                className="btn"
                onClick={() => setOpenMenu(openMenu === 'engine' ? null : 'engine')}
                title="Target workflow engine"
              >
                <Cpu size={15} />
                <span className="btn-label">{ENGINES.find((e) => e.id === engine)?.label}</span>
                <ChevronDown size={13} className="chev" />
              </button>
              {openMenu === 'engine' && (
                <div className="menu-items">
                  {ENGINES.map((entry) => (
                    <button
                      key={entry.id}
                      className={entry.id === engine ? 'active' : ''}
                      onClick={() => handleEngineChange(entry.id)}
                    >
                      <span className="mi-icon"><Cpu size={16} /></span>
                      <span className="mi-text">
                        <strong>{entry.label}</strong>
                        <small>{entry.description}</small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="separator" />

        <div className="group">
          <button
            className="btn icon"
            disabled={!canUndo}
            onClick={() => handleRef.current?.undo?.()}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={15} />
          </button>
          <button
            className="btn icon"
            disabled={!canUndo}
            onClick={() => handleRef.current?.redo?.()}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={15} />
          </button>
        </div>

        <div className="separator" />

        <div className="group">
          <button className="btn icon" onClick={() => handleRef.current?.zoomOut()} title="Zoom out">
            <ZoomOut size={15} />
          </button>
          <button className="btn icon" onClick={() => handleRef.current?.zoomIn()} title="Zoom in">
            <ZoomIn size={15} />
          </button>
          <button className="btn icon" onClick={() => handleRef.current?.zoomFit()} title="Fit to viewport">
            <Maximize size={15} />
          </button>
        </div>

        <div className="separator" />

        <div className="segmented" title="Simple mode hides advanced tools and panels">
          <button className={mode === 'simple' ? 'active' : ''} onClick={() => setMode('simple')}>
            Simple
          </button>
          <button className={mode === 'advanced' ? 'active' : ''} onClick={() => setMode('advanced')}>
            Advanced
          </button>
        </div>

        <div className="file-name">
          <span className="doc-type">{DOC_TYPES[docType].label}</span>
          {renaming ? (
            <input
              className="rename-input"
              autoFocus
              defaultValue={fileName}
              onBlur={(e) => commitRename(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename((e.target as HTMLInputElement).value)
                if (e.key === 'Escape') setRenaming(false)
              }}
            />
          ) : (
            <button className="file-label" onClick={() => setRenaming(true)} title="Click to rename">
              {dirty && <span className="dirty" />}
              {fileName}
            </button>
          )}
        </div>
      </div>

      <div className="editor-wrap">
        {docType === 'bpmn' && (
          <BpmnEditor key={docKey} initialXml={initialContent} engine={engine} {...editorProps} />
        )}
        {docType === 'cmmn' && (
          <CmmnEditor key={docKey} initialXml={initialContent} {...editorProps} />
        )}
        {(docType === 'flowchart' || docType === 'workflow') && (
          <FlowEditor key={docKey} kind={docType} initialJson={initialContent} {...editorProps} />
        )}
      </div>

      {issuesOpen && issues && issues.length > 0 && (
        <div className="issues-panel">
          {issues.map((issue, index) => (
            <button
              key={index}
              className={`issue ${issue.severity}`}
              onClick={() => issue.elementId && handleRef.current?.selectElement(issue.elementId)}
            >
              <span className="badge">{issue.severity === 'error' ? '✖' : '⚠'}</span>
              {issue.message}
            </button>
          ))}
        </div>
      )}

      <div className="statusbar">
        <span className="status-text">{status}</span>
        {issues === null ? (
          <span className="validation-na">Validation not available</span>
        ) : (
          <button
            className={`validation-summary ${errorCount > 0 ? 'has-errors' : warningCount > 0 ? 'has-warnings' : 'ok'}`}
            onClick={() => setIssuesOpen((open) => !open)}
            disabled={issues.length === 0}
          >
            {issues.length === 0
              ? '✔ No issues'
              : `✖ ${errorCount} error${errorCount === 1 ? '' : 's'} · ⚠ ${warningCount} warning${warningCount === 1 ? '' : 's'}`}
          </button>
        )}
      </div>

      <div className="toasts">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.kind}`}>
            {toast.text}
          </div>
        ))}
      </div>
    </div>
  )
}
