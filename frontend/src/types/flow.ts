export type NodeType = 'bit' | 'packet'

export interface NodeRef {
  type: NodeType
  id: number
}

export interface Packet {
  id: number
  name: string
  x: number
  y: number
  flowId?: number | null
}

/** A named group of loose bits and packets, drawn as a frame on the canvas. */
export interface Flow {
  id: number
  name: string
  color: string
}

/** "to" waits for "from". */
export interface Dependency {
  id: number
  fromType: NodeType
  fromId: number
  toType: NodeType
  toId: number
}

export type WorkflowState = 'blocked' | 'ready' | null

export interface PacketSummary {
  total: number
  done: number
  inProgress: number
  blocked: number
  ready: number
  cycles: number
  percent: number
}

export interface PacketCard extends PacketSummary {
  key: number
  name: string
  bitIds: number[]
}

export interface DependencyItem {
  id: number
  d: string
  mx: number
  my: number
  tx: number
  ty: number
  angle: number
  state: 'pending' | 'done' | 'cycle'
  dimmed: boolean
}
