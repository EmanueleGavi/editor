import { newBpmnXml, newCmmnXml, newFlowJson } from './templates'
import type { FilePickerType } from './files'

export type DocType = 'bpmn' | 'cmmn' | 'flowchart' | 'workflow'

export interface DocTypeInfo {
  label: string
  defaultFileName: string
  pickerTypes: FilePickerType[]
  newContent(): string
}

export const DOC_TYPES: Record<DocType, DocTypeInfo> = {
  bpmn: {
    label: 'BPMN Process',
    defaultFileName: 'untitled.bpmn',
    pickerTypes: [{ description: 'BPMN diagram', accept: { 'application/xml': ['.bpmn', '.xml'] } }],
    newContent: newBpmnXml,
  },
  cmmn: {
    label: 'CMMN Case',
    defaultFileName: 'untitled.cmmn',
    pickerTypes: [{ description: 'CMMN diagram', accept: { 'application/xml': ['.cmmn', '.xml'] } }],
    newContent: newCmmnXml,
  },
  flowchart: {
    label: 'Flowchart',
    defaultFileName: 'untitled.flow.json',
    pickerTypes: [{ description: 'Flowchart', accept: { 'application/json': ['.json'] } }],
    newContent: () => newFlowJson('flowchart'),
  },
  workflow: {
    label: 'Workflow',
    defaultFileName: 'untitled.workflow.json',
    pickerTypes: [{ description: 'Workflow', accept: { 'application/json': ['.json'] } }],
    newContent: () => newFlowJson('workflow'),
  },
}

export const OPEN_ACCEPT = '.bpmn,.cmmn,.xml,.json'

export const OPEN_PICKER_TYPES: FilePickerType[] = [
  {
    description: 'Process diagrams',
    accept: {
      'application/xml': ['.bpmn', '.cmmn', '.xml'],
      'application/json': ['.json'],
    },
  },
]

/** Infer the document type from file content (and name as a tie-breaker). */
export function detectDocType(name: string, content: string): DocType | null {
  const trimmed = content.trimStart()
  if (trimmed.startsWith('{')) {
    try {
      const doc = JSON.parse(trimmed) as { type?: string; nodes?: unknown }
      if (Array.isArray(doc.nodes)) return doc.type === 'workflow' ? 'workflow' : 'flowchart'
    } catch {
      return null
    }
    return null
  }
  if (/CMMN\/20151109\/MODEL|<cmmn:/i.test(trimmed) || /\.cmmn$/i.test(name)) return 'cmmn'
  if (/BPMN\/20100524\/MODEL|<bpmn:?/i.test(trimmed) || /\.bpmn$/i.test(name)) return 'bpmn'
  return null
}

export function stripKnownExtension(fileName: string): string {
  return fileName.replace(/\.(flow\.json|workflow\.json|json|bpmn|cmmn|xml)$/i, '')
}
