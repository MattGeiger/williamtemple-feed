"use client"

import { DeleteDialog as SharedDeleteDialog } from "@/components/shared/delete-dialog"
import { Translation } from '@/types/translation'

interface DeleteDialogProps {
  translation: Translation | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (translation: Translation) => Promise<void>
  onError?: (error: Error) => void
  isLoading?: boolean
}

export function DeleteDialog({
  translation,
  open,
  onOpenChange,
  onConfirm,
  onError,
  isLoading
}: DeleteDialogProps) {
  return (
    <SharedDeleteDialog
      item={translation}
      itemType="Translation"
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      onError={onError}
      isLoading={isLoading}
    />
  )
}