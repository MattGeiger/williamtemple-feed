"use client"

import { DeleteDialog as SharedDeleteDialog } from "@/components/shared/delete-dialog"
import { Category } from '@/types/category'

interface DeleteDialogProps {
  category: Category | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (category: Category) => Promise<void>
  onError?: (error: Error) => void
  isLoading?: boolean
}

export function DeleteDialog({
  category,
  open,
  onOpenChange,
  onConfirm,
  onError,
  isLoading
}: DeleteDialogProps) {
  return (
    <SharedDeleteDialog
      item={category}
      itemType="Category"
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      onError={onError}
      isLoading={isLoading}
    />
  )
}