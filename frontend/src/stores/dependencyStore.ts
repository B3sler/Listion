import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/helpers/api'
import { uuidv7 } from '@/helpers/uuid'
import type { Dependency, NodeRef } from '@/types/flow'
import { trackCreate, whenCreated } from './pendingCreates'

export const useDependencyStore = defineStore('dependency', () => {
  const dependencies = ref<Dependency[]>([])

  async function fetchDependencies(): Promise<void> {
    const res = await api.get<Dependency[]>('/api/dependency')
    dependencies.value = res.data
  }

  /**
   * Optimistic: the arrow shows at once; a new bit at either end is created first. A given `id`
   * recreates a removed arrow under its old id (undo); otherwise a new one is generated.
   */
  async function createDependency(from: NodeRef, to: NodeRef, id?: string): Promise<Dependency> {
    const draft: Dependency = {
      id: id ?? uuidv7(),
      fromType: from.type,
      fromId: from.id,
      toType: to.type,
      toId: to.id,
    }
    dependencies.value.push(draft)
    const request = whenCreated(from.id, to.id).then(() =>
      api.post<Dependency>('/api/dependency', draft),
    )
    trackCreate(draft.id, request)
    try {
      const { data } = await request
      // the server answers with the existing arrow (other id) if this one was already there
      dependencies.value = dependencies.value
        .filter((d) => d.id === draft.id || d.id !== data.id)
        .map((d) => (d.id === draft.id ? data : d))
      return data
    } catch (e) {
      dependencies.value = dependencies.value.filter((d) => d.id !== draft.id)
      throw e
    }
  }

  async function deleteDependency(id: string): Promise<void> {
    await whenCreated(id)
    await api.delete(`/api/dependency/${id}`)
    dependencies.value = dependencies.value.filter((d) => d.id !== id)
  }

  return { dependencies, fetchDependencies, createDependency, deleteDependency }
})
