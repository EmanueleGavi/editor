export type EngineId = 'camunda7' | 'camunda8' | 'operaton' | 'flowable' | 'none'

export interface EngineDef {
  id: EngineId
  label: string
  description: string
}

export const ENGINES: EngineDef[] = [
  { id: 'none', label: 'Generic BPMN', description: 'No vendor extensions — plain BPMN 2.0' },
  { id: 'camunda7', label: 'Camunda 7', description: 'Official Camunda Platform 7 properties panel' },
  { id: 'camunda8', label: 'Camunda 8 (Zeebe)', description: 'Official Zeebe properties panel' },
  { id: 'operaton', label: 'Operaton', description: 'Camunda 7-compatible fork — execution properties' },
  { id: 'flowable', label: 'Flowable', description: 'Execution properties (class, assignee, etc.)' },
]

export const DEFAULT_ENGINE: EngineId = 'camunda7'
