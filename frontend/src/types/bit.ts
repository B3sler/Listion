export interface Bit {
  id: number
  user: number
  title: string
  createdAt: Date
  status: number
  dueDate?: Date
  priority?: number
  notes?: string
  x?: number
  y?: number
  workspace?: number
}

export interface CreateBitDto {
  user: number
  title: string
  status?: number
  dueDate?: Date
  priority?: number
  notes?: string
  x?: number
  y?: number
  workspace?: number
}

export interface UpdateBitDto {
  title?: string
  status?: number
  dueDate?: Date
  priority?: number
  notes?: string
  x?: number
  y?: number
  workspace?: number
}
