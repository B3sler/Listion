import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/helpers/api'
import type { Dependency, NodeRef } from '@/types/flow'

export const useDependencyStore = defineStore('dependency', () => {
  const dependencies = ref<Dependency[]>([])

  async function fetchDependencies(): Promise<void> {
    const res = await api.get<Dependency[]>('/api/dependency')
    dependencies.value = res.data
  }

  async function createDependency(from: NodeRef, to: NodeRef): Promise<Dependency> {
    const res = await api.post<Dependency>('/api/dependency', {
      fromType: from.type,
      fromId: from.id,
      toType: to.type,
      toId: to.id,
    })
    if (!dependencies.value.some((d) => d.id === res.data.id)) dependencies.value.push(res.data)
    return res.data
  }

  async function deleteDependency(id: number): Promise<void> {
    await api.delete(`/api/dependency/${id}`)
    dependencies.value = dependencies.value.filter((d) => d.id !== id)
  }

  return { dependencies, fetchDependencies, createDependency, deleteDependency }
})
