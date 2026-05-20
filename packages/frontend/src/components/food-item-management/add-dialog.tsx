import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FoodItemForm } from './form/FoodItemForm'
import { StatusFlags, DietaryFlags } from '@/types/food-item'
import { LimitType } from '@/types/category'

interface AddDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: {
    name: string
    limit: number
    limitType: LimitType
    categoryId: number
    statusFlags: StatusFlags
    dietaryFlags: DietaryFlags
  }) => Promise<boolean>
  isLoading?: boolean
  initialCategoryId?: number
}

export function AddFoodItemDialog({
  open,
  onOpenChange,
  onSave,
  isLoading,
  initialCategoryId
}: AddDialogProps) {
  const handleSave = async (data: {
    name: string
    limit: number
    limitType: LimitType
    categoryId: number
    statusFlags: StatusFlags
    dietaryFlags: DietaryFlags
  }) => {
    const success = await onSave(data);
    // Only close the dialog on successful save
    if (success) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add New Food Item</DialogTitle>
          <DialogDescription>
            Create a new food item. 
            Names must be between 3 and 36 characters.
          </DialogDescription>
        </DialogHeader>
        <FoodItemForm
          onSubmit={handleSave}
          isSaving={isLoading}
          onCancel={() => onOpenChange(false)}
          initialCategoryId={initialCategoryId?.toString() ?? ''}
        />
      </DialogContent>
    </Dialog>
  )
}
