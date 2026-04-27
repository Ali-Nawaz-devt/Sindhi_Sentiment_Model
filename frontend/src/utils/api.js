import axios from 'axios'

const BASE = '/api'

const api = axios.create({ baseURL: BASE, timeout: 120000 })

export const loadData       = ()        => api.get('/load-data').then(r => r.data)
export const cleanData      = (body)    => api.post('/clean-data', body).then(r => r.data)
export const getStats       = ()        => api.get('/dataset-stats').then(r => r.data)
export const trainModel     = (body)    => api.post('/train-model', body).then(r => r.data)
export const getModelResult = (name)    => api.get(`/model-results/${encodeURIComponent(name)}`).then(r => r.data)
export const compareModels  = (body)    => api.post('/compare-models', body).then(r => r.data)
export const getAvailableModels = ()    => api.get('/available-models').then(r => r.data)
export const predict        = (body)    => api.post('/predict', body).then(r => r.data)
export const getFeatureImportance = (n) => api.get(`/feature-importance/${encodeURIComponent(n)}`).then(r => r.data)
export const getLearningCurve = (n)     => api.get(`/learning-curve/${encodeURIComponent(n)}`).then(r => r.data)
export const healthCheck    = ()        => api.get('/health').then(r => r.data)
export const saveModel = (body) => api.post('/save-model', body).then(r => r.data)