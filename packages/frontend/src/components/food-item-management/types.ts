export type FoodItemStatus = 'in_stock' | 'limited' | 'clearance'

export interface NutritionalFlags {
  vegan: boolean
  vegetarian: boolean
  glutenFree: boolean
  organic: boolean
  halal: boolean
  kosher: boolean
  readyToEat: boolean
}

export interface FoodItem {
  id: number
  name: string
  limit: number
  status: FoodItemStatus
  nutritionalFlags: NutritionalFlags
  createdAt: string
  updatedAt: string
}

export interface StatusMessage {
  type: 'success' | 'error' | 'info'
  message: string
}