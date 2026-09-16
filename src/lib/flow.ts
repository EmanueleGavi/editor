// Document model and SVG renderer for the flowchart / workflow editors.
// The on-disk format is plain JSON, independent from React Flow internals.

export type FlowKind = 'flowchart' | 'workflow'
export type FlowNodeKind = 'start' | 'end' | 'task' | 'decision' | 'state' | 'note'
/** Who performs a process block: a person, an automated system, or an AI agent. */
export type ActorKind = 'human' | 'automation' | 'ai'

export interface FlowDocNode {
  id: string
  kind: FlowNodeKind
  label: string
  assignee?: string
  actor?: ActorKind
  x: number
  y: number
}

export interface FlowDocEdge {
  id: string
  from: string
  to: string
  label?: string
}

export interface FlowDoc {
  type: FlowKind
  version: 1
  nodes: FlowDocNode[]
  edges: FlowDocEdge[]
}

export const NODE_SIZES: Record<FlowNodeKind, { w: number; h: number }> = {
  start: { w: 48, h: 48 },
  end: { w: 48, h: 48 },
  task: { w: 160, h: 48 },
  decision: { w: 140, h: 70 },
  state: { w: 160, h: 56 },
  note: { w: 180, h: 80 },
}

export const NODE_COLORS: Record<FlowNodeKind, { fill: string; stroke: string }> = {
  start: { fill: '#ecfdf5', stroke: '#10b981' },
  end: { fill: '#fef2f2', stroke: '#ef4444' },
  task: { fill: '#eff6ff', stroke: '#3b82f6' },
  decision: { fill: '#fffbeb', stroke: '#f59e0b' },
  state: { fill: '#f5f3ff', stroke: '#8b5cf6' },
  note: { fill: '#fefce8', stroke: '#eab308' },
}

export function newFlowDoc(kind: FlowKind): FlowDoc {
  return {
    type: kind,
    version: 1,
    nodes: [
      { id: 'n_start', kind: 'start', label: 'Start', x: 80, y: 60 },
    ],
    edges: [],
  }
}

export function parseFlowDoc(json: string): FlowDoc {
  const doc = JSON.parse(json) as Partial<FlowDoc>
  if (!doc || !Array.isArray(doc.nodes) || !Array.isArray(doc.edges)) {
    throw new Error('Not a valid flow document')
  }
  return {
    type: doc.type === 'workflow' ? 'workflow' : 'flowchart',
    version: 1,
    nodes: doc.nodes as FlowDocNode[],
    edges: doc.edges as FlowDocEdge[],
  }
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

interface Box {
  cx: number
  cy: number
  w: number
  h: number
}

/** Point where the segment from this box's center toward (tx, ty) crosses the box border. */
function borderPoint(box: Box, tx: number, ty: number): { x: number; y: number } {
  const dx = tx - box.cx
  const dy = ty - box.cy
  if (dx === 0 && dy === 0) return { x: box.cx, y: box.cy }
  const scaleX = dx !== 0 ? box.w / 2 / Math.abs(dx) : Infinity
  const scaleY = dy !== 0 ? box.h / 2 / Math.abs(dy) : Infinity
  const t = Math.min(scaleX, scaleY)
  return { x: box.cx + dx * t, y: box.cy + dy * t }
}

/** Small 11×11 vector glyph for the actor badge (kept font-free so PDF export works). */
function actorGlyph(actor: ActorKind, x: number, y: number): string {
  const stroke = '#64748b'
  switch (actor) {
    case 'human':
      return (
        `<g><circle cx="${x + 5.5}" cy="${y + 3.2}" r="2.5" fill="none" stroke="${stroke}" stroke-width="1.4"/>` +
        `<path d="M ${x + 1} ${y + 11} Q ${x + 5.5} ${y + 6} ${x + 10} ${y + 11}" fill="none" stroke="${stroke}" stroke-width="1.4"/></g>`
      )
    case 'automation': {
      const cx = x + 5.5
      const cy = y + 5.5
      let ticks = ''
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4
        ticks += `<line x1="${(cx + Math.cos(a) * 3.1).toFixed(2)}" y1="${(cy + Math.sin(a) * 3.1).toFixed(2)}" x2="${(cx + Math.cos(a) * 5).toFixed(2)}" y2="${(cy + Math.sin(a) * 5).toFixed(2)}" stroke="${stroke}" stroke-width="1.3"/>`
      }
      return `<g><circle cx="${cx}" cy="${cy}" r="2.1" fill="none" stroke="${stroke}" stroke-width="1.4"/>${ticks}</g>`
    }
    case 'ai':
      return `<path d="M ${x + 5.5} ${y} L ${x + 7} ${y + 4} L ${x + 11} ${y + 5.5} L ${x + 7} ${y + 7} L ${x + 5.5} ${y + 11} L ${x + 4} ${y + 7} L ${x} ${y + 5.5} L ${x + 4} ${y + 4} Z" fill="${stroke}"/>`
  }
}

function nodeShapeSvg(node: FlowDocNode, x: number, y: number): string {
  const { w, h } = NODE_SIZES[node.kind]
  const { fill, stroke } = NODE_COLORS[node.kind]
  const cx = x + w / 2
  const cy = y + h / 2
  const label = escapeXml(node.label)
  const text = `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="12" fill="#1f2937">${label}</text>`

  switch (node.kind) {
    case 'start':
      return `<circle cx="${cx}" cy="${cy}" r="${w / 2}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>${text}`
    case 'end':
      return (
        `<circle cx="${cx}" cy="${cy}" r="${w / 2}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>` +
        `<circle cx="${cx}" cy="${cy}" r="${w / 2 - 5}" fill="none" stroke="${stroke}" stroke-width="2"/>${text}`
      )
    case 'decision': {
      const points = `${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}`
      return `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>${text}`
    }
    case 'state': {
      const assignee = node.assignee
        ? `<text x="${cx}" y="${cy + 14}" text-anchor="middle" dominant-baseline="central" font-size="10" fill="#6b7280">@ ${escapeXml(node.assignee)}</text>`
        : ''
      const labelText = `<text x="${cx}" y="${node.assignee ? cy - 6 : cy}" text-anchor="middle" dominant-baseline="central" font-size="12" fill="#1f2937">${label}</text>`
      const badge = node.actor ? actorGlyph(node.actor, x + 8, y + 7) : ''
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="2"/>${labelText}${assignee}${badge}`
    }
    case 'note': {
      const fold = 14
      const body = `M ${x} ${y} H ${x + w - fold} L ${x + w} ${y + fold} V ${y + h} H ${x} Z`
      const foldLine = `M ${x + w - fold} ${y} V ${y + fold} H ${x + w}`
      const lines = node.label.split('\n')
      const textLines = lines
        .map(
          (line, index) =>
            `<text x="${x + 11}" y="${y + 19 + index * 15}" font-size="11" fill="#713f12">${escapeXml(line)}</text>`,
        )
        .join('')
      return (
        `<path d="${body}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>` +
        `<path d="${foldLine}" fill="none" stroke="${stroke}" stroke-width="1.5"/>${textLines}`
      )
    }
    case 'task':
    default: {
      const badge = node.actor ? actorGlyph(node.actor, x + 8, y + 7) : ''
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="2"/>${text}${badge}`
    }
  }
}

/** Render a flow document to a standalone SVG string. */
export function flowToSvg(doc: FlowDoc): string {
  const pad = 40
  const nodes = doc.nodes
  if (nodes.length === 0) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100"></svg>'
  }

  const minX = Math.min(...nodes.map((n) => n.x))
  const minY = Math.min(...nodes.map((n) => n.y))
  const maxX = Math.max(...nodes.map((n) => n.x + NODE_SIZES[n.kind].w))
  const maxY = Math.max(...nodes.map((n) => n.y + NODE_SIZES[n.kind].h))
  const width = Math.ceil(maxX - minX + pad * 2)
  const height = Math.ceil(maxY - minY + pad * 2)

  const boxes = new Map<string, Box>()
  for (const n of nodes) {
    const { w, h } = NODE_SIZES[n.kind]
    boxes.set(n.id, { cx: n.x - minX + pad + w / 2, cy: n.y - minY + pad + h / 2, w, h })
  }

  const edgeSvg = doc.edges
    .map((e) => {
      const a = boxes.get(e.from)
      const b = boxes.get(e.to)
      if (!a || !b) return ''
      const p1 = borderPoint(a, b.cx, b.cy)
      const p2 = borderPoint(b, a.cx, a.cy)
      const line = `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>`
      const label = e.label
        ? `<text x="${(p1.x + p2.x) / 2}" y="${(p1.y + p2.y) / 2 - 6}" text-anchor="middle" font-size="11" fill="#475569" paint-order="stroke" stroke="#ffffff" stroke-width="3">${escapeXml(e.label)}</text>`
        : ''
      return line + label
    })
    .join('\n  ')

  const nodeSvg = nodes
    .map((n) => nodeShapeSvg(n, n.x - minX + pad, n.y - minY + pad))
    .join('\n  ')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="'Segoe UI', system-ui, sans-serif">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b"/>
    </marker>
  </defs>
  <rect width="${width}" height="${height}" fill="#ffffff"/>
  ${edgeSvg}
  ${nodeSvg}
</svg>`
}
