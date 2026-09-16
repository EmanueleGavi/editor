declare module 'bpmn-js-properties-panel' {
  export const BpmnPropertiesPanelModule: Record<string, unknown>
  export const BpmnPropertiesProviderModule: Record<string, unknown>
  export const CamundaPlatformPropertiesProviderModule: Record<string, unknown>
  export const ZeebePropertiesProviderModule: Record<string, unknown>
  export const useService: <T>(name: string) => T
}

declare module '@bpmn-io/properties-panel' {
  export const CheckboxEntry: (props: Record<string, unknown>) => unknown
  export const TextFieldEntry: (props: Record<string, unknown>) => unknown
  export const isCheckboxEntryEdited: (node: unknown) => boolean
  export const isTextFieldEntryEdited: (node: unknown) => boolean
}

declare module 'camunda-bpmn-moddle/resources/camunda.json' {
  const descriptor: Record<string, unknown>
  export default descriptor
}

declare module 'zeebe-bpmn-moddle/resources/zeebe.json' {
  const descriptor: Record<string, unknown>
  export default descriptor
}
