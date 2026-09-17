export const PLANS = {
  free: {
    label: 'Free',
    features: ['editor.bpmn', 'editor.flowchart', 'export.png', 'export.svg', 'export.xml'],
    limits: { flowcharts: 3, members: 1 },
  },
  pro: {
    label: 'Pro',
    features: [
      'editor.bpmn', 'editor.cmmn', 'editor.flowchart', 'editor.workflow',
      'export.png', 'export.svg', 'export.xml', 'export.pdf',
      'templates.advanced',
    ],
    limits: { flowcharts: Infinity, members: 1 },
  },
  team: {
    label: 'Team',
    features: [
      'editor.bpmn', 'editor.cmmn', 'editor.flowchart', 'editor.workflow',
      'export.png', 'export.svg', 'export.xml', 'export.pdf',
      'templates.advanced', 'collaboration.share', 'team.members',
    ],
    limits: { flowcharts: Infinity, members: 10 },
  },
} as const;

export type Plan = keyof typeof PLANS;