import { TableBulkAction } from "@/types/table"
import { Category } from "@/types/category"
import { Trash2 } from "@/components/ui/icons";

export function createCategoryBulkActions(
  onDelete: (categories: Category[]) => Promise<void>
): TableBulkAction<Category>[] {
  return [
    {
      label: "Delete Selected",
      icon: Trash2,
      action: onDelete,
      variant: "destructive",
    }
  ]
}