import { newFlowDoc, type FlowKind } from './flow'

let counter = 1

export function newBpmnXml(): string {
  const id = `Process_${Date.now()}_${counter++}`
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  id="Definitions_${id}"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="${id}" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="Start" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${id}">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="156" y="82" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`
}

export function newCmmnXml(): string {
  const id = `Case_${Date.now()}_${counter++}`
  return `<?xml version="1.0" encoding="UTF-8"?>
<cmmn:definitions xmlns:cmmn="http://www.omg.org/spec/CMMN/20151109/MODEL"
                  xmlns:cmmndi="http://www.omg.org/spec/CMMN/20151109/CMMNDI"
                  xmlns:dc="http://www.omg.org/spec/CMMN/20151109/DC"
                  id="Definitions_${id}"
                  targetNamespace="http://bpmn.io/schema/cmmn">
  <cmmn:case id="${id}">
    <cmmn:casePlanModel id="CasePlanModel_1" name="Case plan">
      <cmmn:planItem id="PlanItem_1" definitionRef="Task_1" />
      <cmmn:task id="Task_1" name="Task" />
    </cmmn:casePlanModel>
  </cmmn:case>
  <cmmndi:CMMNDI>
    <cmmndi:CMMNDiagram id="CMMNDiagram_1">
      <cmmndi:Size width="500" height="500" />
      <cmmndi:CMMNShape id="DI_CasePlanModel_1" cmmnElementRef="CasePlanModel_1">
        <dc:Bounds x="114" y="63" width="534" height="389" />
        <cmmndi:CMMNLabel />
      </cmmndi:CMMNShape>
      <cmmndi:CMMNShape id="PlanItem_1_di" cmmnElementRef="PlanItem_1">
        <dc:Bounds x="150" y="96" width="100" height="80" />
        <cmmndi:CMMNLabel />
      </cmmndi:CMMNShape>
    </cmmndi:CMMNDiagram>
  </cmmndi:CMMNDI>
</cmmn:definitions>`
}

export function newFlowJson(kind: FlowKind): string {
  return JSON.stringify(newFlowDoc(kind), null, 2)
}
