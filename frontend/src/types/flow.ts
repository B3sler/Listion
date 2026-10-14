export type NodeType = 'bit' | 'packet'

export interface NodeRef {
  type: NodeType
  id: string
}

export interface Packet {
  id: string
  name: string
  x: number
  y: number
  flowId?: string | null
}

/** A named group of loose bits and packets, drawn as a frame on the canvas. */
export interface Flow {
  id: string
  name: string
  color: string
}

/** "to" waits for "from". */
export interface Dependency {
  id: string
  fromType: NodeType
  fromId: string
  toType: NodeType
  toId: string
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
  key: string
  name: string
  bitIds: string[]
}

export interface DependencyItem {
  id: string
  d: string
  mx: number
  my: number
  tx: number
  ty: number
  angle: number
  state: 'pending' | 'done' | 'cycle'
  dimmed: boolean
}
