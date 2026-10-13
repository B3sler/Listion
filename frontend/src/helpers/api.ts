import axios from 'axios'

const api = axios.create({
  // Leer = gleicher Origin: im Dev über den Vite-Proxy, in Produktion über nginx
  baseURL: import.meta.env.VITE_API_ORIGIN ?? '',
  withCredentials: true,
})

export default api
