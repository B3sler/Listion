import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/helpers/api'
import type { Bit, CreateBitDto, UpdateBitDto } from '@/types/bit'
import type { AxiosError } from 'axios'

export const useBitStore = defineStore('bit', () => {
  const bits = ref<Bit[]>([])
  const error = ref<string | null>(null)
  const loading = ref(false)

  async function fetchBits() {
    loading.value = true
    error.value = null
    try {
      const res = await api.get<Bit[]>('/api/bit')
      bits.value = res.data
    } catch (e) {
      const axiosError = e as AxiosError<{ message?: string }>
      error.value = axiosError?.response?.data?.message || 'Failed to fetch bits.'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createBit(createBitDto: CreateBitDto) {
    loading.value = true
    error.value = null
    try {
      const res = await api.post<Bit>('/api/bit', createBitDto)
      bits.value.push(res.data)
      return res.data
    } catch (e) {
      const axiosError = e as AxiosError<{ message?: string }>
      error.value = axiosError?.response?.data?.message || 'Failed to create bit.'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateBit(id: number, updateBitDto: UpdateBitDto) {
    loading.value = true
    error.value = null
    try {
      const res = await api.put<Bit>(`/api/bit/${id}`, updateBitDto)
      const index = bits.value.findIndex((b) => b.id === id)
      if (index !== -1 && res.data) {
        bits.value[index] = res.data
      }
      return res.data
    } catch (e) {
      const axiosError = e as AxiosError<{ message?: string }>
      error.value = axiosError?.response?.data?.message || 'Failed to update bit.'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteBit(id: number) {
    loading.value = true
    error.value = null
    try {
      await api.delete(`/api/bit/${id}`)
      bits.value = bits.value.filter((b) => b.id !== id)
    } catch (e) {
      const axiosError = e as AxiosError<{ message?: string }>
      error.value = axiosError?.response?.data?.message || 'Failed to delete bit.'
      throw e
    } finally {
      loading.value = false
    }
  }

  return { bits, error, loading, fetchBits, createBit, updateBit, deleteBit }
})
