"use client"

import { BulkDeleteDialog as SharedBulkDeleteDialog } from "@/components/shared/bulk-delete-dialog"
import { Category } from '@/types/category'

interface BulkDeleteDialogProps {
  categories: Category[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (categories: Category[]) => Promise<void>
  onError?: (error: Error) => void
  isLoading?: boolean
}

export function BulkDeleteDialog({
  categories,
  open,
  onOpenChange,
  onConfirm,
  onError,
  isLoading
}: BulkDeleteDialogProps) {
  return (
    <SharedBulkDeleteDialog
      items={categories}
      itemType="Category"
      pluralItemType="Categories"
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      onError={onError}
      isLoading={isLoading}
    />
  )
}
