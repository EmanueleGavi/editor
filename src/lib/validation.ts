import type { FlowDoc } from './flow'

export interface Issue {
  severity: 'error' | 'warning'
  message: string
  /** Diagram element to select when the user clicks the issue. */
  elementId?: string
}

// ---------------------------------------------------------------------------
// BPMN — rule-based checks over bpmn-js elementRegistry entries
// ---------------------------------------------------------------------------

interface ModdleRef {
  id?: string
  name?: string
  conditionExpression?: unknown
}

interface BpmnBusinessObject {
  name?: string
  incoming?: ModdleRef[]
  outgoing?: ModdleRef[]
  default?: ModdleRef
}

export interface BpmnElementLike {
  id: string
  type: string
  businessObject: BpmnBusinessObject
}

const TASK_TYPES = new Set([
  'bpmn:Task',
  'bpmn:UserTask',
  'bpmn:ServiceTask',
  'bpmn:ScriptTask',
  'bpmn:ManualTask',
  'bpmn:BusinessRuleTask',
  'bpmn:SendTask',
  'bpmn:ReceiveTask',
  'bpmn:CallActivity',
  'bpmn:SubProcess',
])

const GATEWAY_TYPES = new Set([
  'bpmn:ExclusiveGateway',
  'bpmn:ParallelGateway',
  'bpmn:InclusiveGateway',
  'bpmn:EventBasedGateway',
])

const FLOW_NODE_TYPES = new Set([
  ...TASK_TYPES,
  ...GATEWAY_TYPES,
  'bpmn:StartEvent',
  'bpmn:EndEvent',
  'bpmn:IntermediateThrowEvent',
  'bpmn:IntermediateCatchEvent',
])

function elementLabel(el: BpmnElementLike): string {
  const typeName = el.type.replace('bpmn:', '')
  return el.businessObject.name ? `"${el.businessObject.name}"` : `${typeName} <${el.id}>`
}

export function validateBpmnElements(elements: BpmnElementLike[]): Issue[] {
  const issues: Issue[] = []
  const flowNodes = elements.filter((el) => FLOW_NODE_TYPES.has(el.type))

  if (!flowNodes.some((el) => el.type === 'bpmn:StartEvent')) {
    issues.push({ severity: 'warning', message: 'Process has no start event' })
  }
  if (!flowNodes.some((el) => el.type === 'bpmn:EndEvent')) {
    issues.push({ severity: 'warning', message: 'Process has no end event' })
  }

  for (const el of flowNodes) {
    const bo = el.businessObject
    const incoming = bo.incoming ?? []
    const outgoing = bo.outgoing ?? []

    if (el.type !== 'bpmn:StartEvent' && incoming.length === 0) {
      issues.push({
        severity: 'error',
        message: `${elementLabel(el)} has no incoming connection`,
        elementId: el.id,
      })
    }
    if (el.type !== 'bpmn:EndEvent' && outgoing.length === 0) {
      issues.push({
        severity: 'error',
        message: `${elementLabel(el)} has no outgoing connection`,
        elementId: el.id,
      })
    }

    if (TASK_TYPES.has(el.type) && !bo.name) {
      issues.push({ severity: 'warning', message: `Unnamed task <${el.id}>`, elementId: el.id })
    }

    if ((el.type === 'bpmn:ExclusiveGateway' || el.type === 'bpmn:InclusiveGateway') && outgoing.length > 1) {
      const unlabeled = outgoing.filter(
        (flow) => flow !== bo.default && !flow.name && !flow.conditionExpression,
      )
      if (unlabeled.length > 0) {
        issues.push({
          severity: 'warning',
          message: `Gateway ${elementLabel(el)} has ${unlabeled.length} branch(es) without a condition or label`,
          elementId: el.id,
        })
      }
      if (!bo.default) {
        issues.push({
          severity: 'warning',
          message: `Gateway ${elementLabel(el)} has no default branch`,
          elementId: el.id,
        })
      }
    }
  }

  return issues
}

// ---------------------------------------------------------------------------
// Flowchart / workflow — checks over the flow JSON document
// ---------------------------------------------------------------------------

export function validateFlowDoc(doc: FlowDoc): Issue[] {
  const issues: Issue[] = []
  // Notes are free-floating annotations: exempt from connectivity rules
  const flowNodes = doc.nodes.filter((n) => n.kind !== 'note')
  const starts = flowNodes.filter((n) => n.kind === 'start')
  const ends = flowNodes.filter((n) => n.kind === 'end')

  if (starts.length === 0) issues.push({ severity: 'warning', message: 'Diagram has no Start node' })
  if (ends.length === 0) issues.push({ severity: 'warning', message: 'Diagram has no End node' })

  const incoming = new Map<string, number>()
  const outgoing = new Map<string, string[]>()
  for (const e of doc.edges) {
    incoming.set(e.to, (incoming.get(e.to) ?? 0) + 1)
    outgoing.set(e.from, [...(outgoing.get(e.from) ?? []), e.to])
  }

  // Reachability from start nodes
  const reachable = new Set<string>()
  const queue = starts.map((n) => n.id)
  while (queue.length > 0) {
    const id = queue.pop()!
    if (reachable.has(id)) continue
    reachable.add(id)
    queue.push(...(outgoing.get(id) ?? []))
  }

  for (const node of flowNodes) {
    const label = node.label ? `"${node.label}"` : `<${node.id}>`
    const out = outgoing.get(node.id) ?? []
    const inc = incoming.get(node.id) ?? 0

    if (node.kind === 'start' && inc > 0) {
      issues.push({ severity: 'error', message: `Start node ${label} has incoming transitions`, elementId: node.id })
    }
    if (node.kind === 'end' && out.length > 0) {
      issues.push({ severity: 'error', message: `End node ${label} has outgoing transitions`, elementId: node.id })
    }
    if (node.kind !== 'start' && inc === 0 && starts.length > 0 && !reachable.has(node.id)) {
      issues.push({ severity: 'warning', message: `${label} is not reachable from Start`, elementId: node.id })
    }
    if (node.kind !== 'end' && node.kind !== 'start' && out.length === 0) {
      issues.push({ severity: 'warning', message: `${label} has no outgoing transition`, elementId: node.id })
    }
    if (node.kind === 'decision') {
      if (out.length < 2) {
        issues.push({
          severity: 'warning',
          message: `Decision ${label} should have at least two outgoing branches`,
          elementId: node.id,
        })
      }
      const unlabeled = doc.edges.filter((e) => e.from === node.id && !e.label)
      if (out.length >= 2 && unlabeled.length > 0) {
        issues.push({
          severity: 'warning',
          message: `Decision ${label} has ${unlabeled.length} unlabeled branch(es)`,
          elementId: node.id,
        })
      }
    }
    if (doc.type === 'workflow' && node.kind === 'state' && !node.assignee) {
      issues.push({ severity: 'warning', message: `State ${label} has no assignee`, elementId: node.id })
    }
    if ((node.kind === 'task' || node.kind === 'state' || node.kind === 'decision') && !node.label.trim()) {
      issues.push({ severity: 'warning', message: `Unnamed node <${node.id}>`, elementId: node.id })
    }
  }

  return issues
}
