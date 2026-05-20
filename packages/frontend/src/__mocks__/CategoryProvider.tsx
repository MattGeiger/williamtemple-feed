import React from 'react'
import { CategoryContext } from '@/contexts/CategoryContext'

const mockCategories = [
  {
    id: 1,
    name: 'Test Category',
    limit: 10,
    createdAt: '2025-01-20T12:00:00Z',
    updatedAt: '2025-01-20T12:00:00Z'
  }
]

export const CategoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <CategoryContext.Provider
      value={{
        categories: mockCategories,
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      }}
    >
      {children}
    </CategoryContext.Provider>
  )
}