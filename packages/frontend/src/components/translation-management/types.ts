export interface Translation {
  id: number
  key: string
  text: string
  language: string
  createdAt: string
  updatedAt: string
}

export interface StatusMessage {
  type: 'success' | 'error' | 'info'
  message: string
}