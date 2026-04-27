import { useState, useCallback } from 'react'

export function useApi(apiFn) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const execute = useCallback(async (...args) => {
    setLoading(true)
    setError(null)
    try {
      const result = await apiFn(...args)
      setData(result)
      return result
    } catch (e) {
      const msg = e?.response?.data?.detail || e.message || 'Unknown error'
      setError(msg)
      throw e
    } finally {
      setLoading(false)
    }
  }, [apiFn])

  return { data, loading, error, execute }
}
