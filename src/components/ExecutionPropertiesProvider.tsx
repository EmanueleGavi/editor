import {
  CheckboxEntry,
  TextFieldEntry,
  isCheckboxEntryEdited,
  isTextFieldEntryEdited,
} from '@bpmn-io/properties-panel'
import { useService } from 'bpmn-js-properties-panel'

// Generic "execution properties" group for engines without an official
// bpmn-js-properties-panel provider (Operaton, Flowable). Both engines use
// the same attribute names as Camunda 7 for this common subset, just under
// their own XML namespace/prefix — see src/lib/engineModdle.ts.

interface BusinessObject {
  get(key: string): unknown
  $instanceOf(type: string): boolean
}

interface BpmnElement {
  id: string
  businessObject: BusinessObject
}

interface ModelingService {
  updateModdleProperties(element: BpmnElement, moddleElement: unknown, properties: Record<string, unknown>): void
}

interface EntryProps {
  element: BpmnElement
  prefix: string
  name: string
  label: string
  placeholder?: string
}

function isServiceTaskLike(bo: BusinessObject) {
  return (
    bo.$instanceOf('bpmn:ServiceTask') ||
    bo.$instanceOf('bpmn:SendTask') ||
    bo.$instanceOf('bpmn:BusinessRuleTask')
  )
}

function isActivityOrGateway(bo: BusinessObject) {
  return bo.$instanceOf('bpmn:Activity') || bo.$instanceOf('bpmn:Gateway')
}

function BooleanField(props: EntryProps) {
  const { element, prefix, name, label } = props
  const modeling = useService<ModelingService>('modeling')
  const key = `${prefix}:${name}`
  return CheckboxEntry({
    element,
    id: key,
    label,
    getValue: () => Boolean(element.businessObject.get(key)),
    setValue: (value: boolean) =>
      modeling.updateModdleProperties(element, element.businessObject, { [key]: value }),
  })
}

function StringField(props: EntryProps) {
  const { element, prefix, name, label, placeholder } = props
  const modeling = useService<ModelingService>('modeling')
  const key = `${prefix}:${name}`
  return TextFieldEntry({
    element,
    id: key,
    label,
    placeholder,
    getValue: () => (element.businessObject.get(key) as string) ?? '',
    setValue: (value: string) =>
      modeling.updateModdleProperties(element, element.businessObject, { [key]: value || undefined }),
  })
}

function buildEntries(element: BpmnElement, prefix: string, engineLabel: string) {
  const bo = element.businessObject
  const entries: { id: string; component: (p: EntryProps) => unknown; isEdited?: unknown; element: BpmnElement; prefix: string; name: string; label: string; placeholder?: string }[] = []

  if (isActivityOrGateway(bo)) {
    entries.push(
      { id: `${prefix}-async`, component: BooleanField, isEdited: isCheckboxEntryEdited, element, prefix, name: 'async', label: 'Asynchronous' },
      { id: `${prefix}-exclusive`, component: BooleanField, isEdited: isCheckboxEntryEdited, element, prefix, name: 'exclusive', label: 'Exclusive' },
    )
  }

  if (isServiceTaskLike(bo)) {
    entries.push(
      { id: `${prefix}-class`, component: StringField, isEdited: isTextFieldEntryEdited, element, prefix, name: 'class', label: 'Java class', placeholder: 'fully.qualified.ClassName' },
      { id: `${prefix}-expression`, component: StringField, isEdited: isTextFieldEntryEdited, element, prefix, name: 'expression', label: 'Expression' },
      { id: `${prefix}-delegateExpression`, component: StringField, isEdited: isTextFieldEntryEdited, element, prefix, name: 'delegateExpression', label: 'Delegate expression' },
    )
  }

  if (bo.$instanceOf('bpmn:UserTask')) {
    entries.push(
      { id: `${prefix}-assignee`, component: StringField, isEdited: isTextFieldEntryEdited, element, prefix, name: 'assignee', label: 'Assignee' },
      { id: `${prefix}-candidateUsers`, component: StringField, isEdited: isTextFieldEntryEdited, element, prefix, name: 'candidateUsers', label: 'Candidate users' },
      { id: `${prefix}-candidateGroups`, component: StringField, isEdited: isTextFieldEntryEdited, element, prefix, name: 'candidateGroups', label: 'Candidate groups' },
    )
  }

  return entries.length > 0
    ? [{ id: `${prefix}-execution`, label: `Execution (${engineLabel})`, entries }]
    : []
}

export function createExecutionPropertiesProvider(prefix: string, engineLabel: string) {
  function ExecutionPropertiesProvider(
    this: { getGroups: (element: BpmnElement) => (groups: unknown[]) => unknown[] },
    propertiesPanel: { registerProvider: (priority: number, provider: unknown) => void },
  ) {
    this.getGroups = (element: BpmnElement) => (groups: unknown[]) => [
      ...groups,
      ...buildEntries(element, prefix, engineLabel),
    ]
    propertiesPanel.registerProvider(500, this)
  }
  ;(ExecutionPropertiesProvider as unknown as { $inject: string[] }).$inject = ['propertiesPanel']

  return {
    __init__: ['executionPropertiesProvider'],
    executionPropertiesProvider: ['type', ExecutionPropertiesProvider],
  }
}
