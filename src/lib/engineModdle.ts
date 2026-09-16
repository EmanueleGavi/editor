// Minimal moddle descriptors for engines that don't ship an official
// bpmn-js moddle/properties-panel package (Operaton, Flowable). Both
// engines share Camunda 7's execution-property vocabulary (Operaton is a
// direct Camunda 7 fork; Flowable inherited the same attribute names from
// Activiti), so a single generator covers both — only name/uri/prefix change.

function buildExecutionModdle(name: string, uri: string, prefix: string) {
  return {
    name,
    uri,
    prefix,
    xml: { tagAlias: 'lowerCase' },
    associations: [],
    types: [
      {
        name: 'AsyncCapable',
        isAbstract: true,
        extends: ['bpmn:Activity', 'bpmn:Gateway'],
        properties: [
          { name: 'async', isAttr: true, type: 'Boolean', default: false },
          { name: 'exclusive', isAttr: true, type: 'Boolean', default: true },
        ],
      },
      {
        name: 'ServiceTaskLike',
        isAbstract: true,
        extends: ['bpmn:ServiceTask', 'bpmn:SendTask', 'bpmn:BusinessRuleTask'],
        properties: [
          { name: 'class', isAttr: true, type: 'String' },
          { name: 'expression', isAttr: true, type: 'String' },
          { name: 'delegateExpression', isAttr: true, type: 'String' },
        ],
      },
      {
        name: 'Assignable',
        isAbstract: true,
        extends: ['bpmn:UserTask'],
        properties: [
          { name: 'assignee', isAttr: true, type: 'String' },
          { name: 'candidateUsers', isAttr: true, type: 'String' },
          { name: 'candidateGroups', isAttr: true, type: 'String' },
        ],
      },
    ],
  }
}

export const operatonModdle = buildExecutionModdle(
  'Operaton',
  'http://operaton.org/schema/1.0/bpmn',
  'operaton',
)

export const flowableModdle = buildExecutionModdle(
  'Flowable',
  'http://flowable.org/bpmn',
  'flowable',
)
