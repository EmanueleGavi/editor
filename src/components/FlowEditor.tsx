import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type ReactFlowInstance,
  type NodeProps,
} from '@xyflow/react'
import { Ban, Bot, Cog, User } from 'lucide-react'
import '@xyflow/react/dist/style.css'

import type { EditorHandle } from '../lib/editorHandle'
import { validateFlowDoc } from '../lib/validation'
import {
  NODE_SIZES,
  NODE_COLORS,
  flowToSvg,
  parseFlowDoc,
  type ActorKind,
  type FlowDoc,
  type FlowKind,
  type FlowNodeKind,
} from '../lib/flow'

type FlowNodeData = { label: string; assignee?: string; actor?: ActorKind }
type FlowNode = Node<FlowNodeData>
type FlowEdge = Edge

let idCounter = 1
const nextId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${idCounter++}`

const ACTOR_OPTIONS: { value: ActorKind | undefined; icon: React.ReactNode; label: string }[] = [
  { value: undefined, icon: <Ban size={13} />, label: 'None' },
  { value: 'human', icon: <User size={13} />, label: 'Human' },
  { value: 'automation', icon: <Cog size={13} />, label: 'Automation' },
  { value: 'ai', icon: <Bot size={13} />, label: 'AI agent' },
]

const ACTOR_BADGES: Record<ActorKind, React.ReactNode> = {
  human: <User size={12} />,
  automation: <Cog size={12} />,
  ai: <Bot size={12} />,
}

// --- Custom node components -------------------------------------------------

function nodeData(props: NodeProps): FlowNodeData {
  return props.data as FlowNodeData
}

function RoundNode(props: NodeProps) {
  const kind = props.type as FlowNodeKind
  return (
    <div className={`fnode ${kind}`}>
      {kind !== 'start' && <Handle type="target" position={Position.Top} />}
      <span>{nodeData(props).label}</span>
      {kind !== 'end' && <Handle type="source" position={Position.Bottom} />}
    </div>
  )
}

function BoxNode(props: NodeProps) {
  const data = nodeData(props)
  const kind = props.type as FlowNodeKind
  return (
    <div className={`fnode ${kind}`}>
      <Handle type="target" position={Position.Top} />
      {data.actor && (
        <span className="actor-badge" title={`Performed by: ${data.actor}`}>
          {ACTOR_BADGES[data.actor]}
        </span>
      )}
      <span>{data.label}</span>
      {kind === 'state' && data.assignee && <small className="assignee">@ {data.assignee}</small>}
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

function DecisionNode(props: NodeProps) {
  const { w, h } = NODE_SIZES.decision
  return (
    <div className="fnode decision" style={{ width: w, height: h }}>
      <Handle type="target" position={Position.Top} />
      <svg className="diamond" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <polygon
          points={`${w / 2},1 ${w - 1},${h / 2} ${w / 2},${h - 1} 1,${h / 2}`}
          fill="#fffbeb"
          stroke="#f59e0b"
          strokeWidth="2"
        />
      </svg>
      <span>{nodeData(props).label}</span>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

function NoteNode(props: NodeProps) {
  return (
    <div className="fnode note">
      <span>{nodeData(props).label}</span>
    </div>
  )
}

const nodeTypes = {
  start: RoundNode,
  end: RoundNode,
  task: BoxNode,
  state: BoxNode,
  decision: DecisionNode,
  note: NoteNode,
}

// --- Document <-> React Flow conversion --------------------------------------

function docToRf(doc: FlowDoc): { nodes: FlowNode[]; edges: FlowEdge[] } {
  return {
    nodes: doc.nodes.map((n) => ({
      id: n.id,
      type: n.kind,
      position: { x: n.x, y: n.y },
      data: { label: n.label, assignee: n.assignee, actor: n.actor },
    })),
    edges: doc.edges.map((e) => ({
      id: e.id,
      source: e.from,
      target: e.to,
      label: e.label,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed },
    })),
  }
}

function rfToDoc(kind: FlowKind, nodes: FlowNode[], edges: FlowEdge[]): FlowDoc {
  return {
    type: kind,
    version: 1,
    nodes: nodes.map((n) => ({
      id: n.id,
      kind: (n.type ?? 'task') as FlowNodeKind,
      label: n.data.label,
      assignee: n.data.assignee || undefined,
      actor: n.data.actor || undefined,
      x: n.position.x,
      y: n.position.y,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      from: e.source,
      to: e.target,
      label: typeof e.label === 'string' && e.label ? e.label : undefined,
    })),
  }
}

// --- Editor -------------------------------------------------------------------

interface FlowEditorProps {
  kind: FlowKind
  initialJson: string
  onReady: (handle: EditorHandle) => void
  onChanged: () => void
  onError: (message: string, err: unknown) => void
}

const PALETTES: Record<FlowKind, { kind: FlowNodeKind; label: string }[]> = {
  flowchart: [
    { kind: 'start', label: 'Start' },
    { kind: 'task', label: 'Process' },
    { kind: 'decision', label: 'Decision' },
    { kind: 'end', label: 'End' },
    { kind: 'note', label: 'Note' },
  ],
  workflow: [
    { kind: 'start', label: 'Start' },
    { kind: 'state', label: 'State' },
    { kind: 'decision', label: 'Decision' },
    { kind: 'end', label: 'End' },
    { kind: 'note', label: 'Note' },
  ],
}

const DEFAULT_LABELS: Record<FlowNodeKind, string> = {
  start: 'Start',
  end: 'End',
  task: 'Process',
  decision: 'Decision?',
  state: 'State',
  note: 'Note',
}

function FlowEditorInner({ kind, initialJson, onReady, onChanged, onError }: FlowEditorProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<ReactFlowInstance<FlowNode, FlowEdge> | null>(null)

  const initial = useMemo(() => {
    try {
      return docToRf(parseFlowDoc(initialJson))
    } catch (err) {
      onError('Failed to load flow document', err)
      return { nodes: [], edges: [] }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [nodes, setNodes] = useState<FlowNode[]>(initial.nodes)
  const [edges, setEdges] = useState<FlowEdge[]>(initial.edges)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)

  const stateRef = useRef({ nodes, edges })
  stateRef.current = { nodes, edges }
  const callbacksRef = useRef({ onChanged })
  callbacksRef.current = { onChanged }

  useEffect(() => {
    onReady({
      getContent: async () =>
        JSON.stringify(rfToDoc(kind, stateRef.current.nodes, stateRef.current.edges), null, 2),
      getSvg: async () => flowToSvg(rfToDoc(kind, stateRef.current.nodes, stateRef.current.edges)),
      zoomIn: () => void instanceRef.current?.zoomIn(),
      zoomOut: () => void instanceRef.current?.zoomOut(),
      zoomFit: () => void instanceRef.current?.fitView({ padding: 0.2 }),
      undo: null,
      redo: null,
      validate: () => validateFlowDoc(rfToDoc(kind, stateRef.current.nodes, stateRef.current.edges)),
      selectElement: (id) => {
        setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === id })))
        setEdges((es) => es.map((e) => ({ ...e, selected: e.id === id })))
        setSelectedNodeId(id)
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
    setNodes((ns) => applyNodeChanges(changes, ns))
    if (changes.some((c) => c.type === 'position' || c.type === 'remove')) {
      callbacksRef.current.onChanged()
    }
  }, [])

  const handleEdgesChange = useCallback((changes: EdgeChange<FlowEdge>[]) => {
    setEdges((es) => applyEdgeChanges(changes, es))
    if (changes.some((c) => c.type === 'remove')) callbacksRef.current.onChanged()
  }, [])

  const handleConnect = useCallback((connection: Connection) => {
    setEdges((es) =>
      addEdge(
        {
          ...connection,
          id: nextId('e'),
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed },
        },
        es,
      ),
    )
    callbacksRef.current.onChanged()
  }, [])

  const addNodeAt = useCallback((nodeKind: FlowNodeKind, position?: { x: number; y: number }) => {
    const size = NODE_SIZES[nodeKind]
    let pos = position
    if (!pos) {
      const rect = wrapRef.current?.getBoundingClientRect()
      const center = instanceRef.current?.screenToFlowPosition({
        x: (rect?.left ?? 0) + (rect?.width ?? 600) / 2,
        y: (rect?.top ?? 0) + (rect?.height ?? 400) / 2,
      }) ?? { x: 200, y: 200 }
      const jitter = () => Math.round((Math.random() - 0.5) * 60)
      pos = { x: center.x + jitter(), y: center.y + jitter() }
    }
    setNodes((ns) => [
      ...ns,
      {
        id: nextId('n'),
        type: nodeKind,
        position: { x: pos.x - size.w / 2, y: pos.y - size.h / 2 },
        data: { label: DEFAULT_LABELS[nodeKind] },
      },
    ])
    callbacksRef.current.onChanged()
  }, [])

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const nodeKind = event.dataTransfer.getData('application/flow-node') as FlowNodeKind
      if (!nodeKind || !(nodeKind in NODE_SIZES)) return
      const position = instanceRef.current?.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      addNodeAt(nodeKind, position)
    },
    [addNodeAt],
  )

  const renameNode = useCallback((id: string, currentLabel: string) => {
    const label = window.prompt('Label', currentLabel)
    if (label === null) return
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n)))
    callbacksRef.current.onChanged()
  }, [])

  const updateSelectedNode = useCallback((patch: Partial<FlowNodeData>) => {
    setNodes((ns) => ns.map((n) => (n.selected ? { ...n, data: { ...n.data, ...patch } } : n)))
    callbacksRef.current.onChanged()
  }, [])

  const updateSelectedEdgeLabel = useCallback((label: string) => {
    setEdges((es) => es.map((e) => (e.selected ? { ...e, label } : e)))
    callbacksRef.current.onChanged()
  }, [])

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) ?? null
  const isProcessBlock = selectedNode?.type === 'task' || selectedNode?.type === 'state'

  return (
    <div ref={wrapRef} className={`editor-canvas flow-editor ${kind}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onInit={(instance) => {
          instanceRef.current = instance
          instance.fitView({ padding: 0.3, maxZoom: 1 })
        }}
        onNodeDoubleClick={(_evt, node) => {
          if (node.type !== 'note') renameNode(node.id, node.data.label)
        }}
        onSelectionChange={({ nodes: selNodes, edges: selEdges }) => {
          setSelectedNodeId(selNodes[0]?.id ?? null)
          setSelectedEdgeId(selEdges[0]?.id ?? null)
        }}
        deleteKeyCode={['Backspace', 'Delete']}
        fitView={false}
        proOptions={{ hideAttribution: true }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <MiniMap className="flow-minimap" pannable zoomable />
      </ReactFlow>

      <div className="flow-palette">
        {PALETTES[kind].map((entry) => (
          <button
            key={entry.kind}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData('application/flow-node', entry.kind)
              event.dataTransfer.effectAllowed = 'move'
            }}
            onClick={() => addNodeAt(entry.kind)}
            title={`Click or drag to add ${entry.label}`}
          >
            <span className="swatch" style={{ background: NODE_COLORS[entry.kind].stroke }} />
            {entry.label}
          </button>
        ))}
        <div className="palette-hint">click or drag</div>
      </div>

      {(selectedNode || selectedEdge) && (
        <div className="props-panel">
          {selectedNode && (
            <>
              <h3>{selectedNode.type === 'note' ? 'Note' : 'Node'}</h3>
              {selectedNode.type === 'note' ? (
                <label>
                  Text
                  <textarea
                    rows={4}
                    value={selectedNode.data.label}
                    onChange={(e) => updateSelectedNode({ label: e.target.value })}
                  />
                </label>
              ) : (
                <label>
                  Label
                  <input
                    value={selectedNode.data.label}
                    onChange={(e) => updateSelectedNode({ label: e.target.value })}
                  />
                </label>
              )}
              {isProcessBlock && (
                <div className="actor-picker">
                  <span className="picker-label">Performed by</span>
                  <div className="actor-options">
                    {ACTOR_OPTIONS.map((option) => (
                      <button
                        key={option.label}
                        className={selectedNode.data.actor === option.value ? 'active' : ''}
                        title={option.label}
                        onClick={() => updateSelectedNode({ actor: option.value })}
                      >
                        {option.icon}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {kind === 'workflow' && selectedNode.type === 'state' && (
                <label>
                  Assignee
                  <input
                    value={selectedNode.data.assignee ?? ''}
                    placeholder="user or role"
                    onChange={(e) => updateSelectedNode({ assignee: e.target.value })}
                  />
                </label>
              )}
            </>
          )}
          {selectedEdge && !selectedNode && (
            <>
              <h3>Transition</h3>
              <label>
                Label
                <input
                  value={typeof selectedEdge.label === 'string' ? selectedEdge.label : ''}
                  placeholder={kind === 'workflow' ? 'action / condition' : 'condition'}
                  onChange={(e) => updateSelectedEdgeLabel(e.target.value)}
                />
              </label>
            </>
          )}
          <p className="hint">Tip: double-click a node to rename it. Del removes the selection.</p>
        </div>
      )}
    </div>
  )
}

export default function FlowEditor(props: FlowEditorProps) {
  return (
    <ReactFlowProvider>
      <FlowEditorInner {...props} />
    </ReactFlowProvider>
  )
}
