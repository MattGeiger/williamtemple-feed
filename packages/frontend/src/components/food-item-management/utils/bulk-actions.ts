import { TableBulkAction } from "@/types/table"
import { FoodItem } from "@/types/food-item"
import { Trash2, Package, Ban, ArrowLeftRight } from "@/components/ui/icons";

export function createFoodItemBulkActions(
  onDelete: (items: FoodItem[]) => Promise<void>,
  onSetInStock: (items: FoodItem[]) => Promise<void>,
  onSetOutOfStock: (items: FoodItem[]) => Promise<void>,
  onChangeCategory: (items: FoodItem[]) => Promise<void>
): TableBulkAction<FoodItem>[] {
  return [
    {
      label: "Set In Stock",
      icon: Package,
      action: onSetInStock,
    },
    {
      label: "Set Out of Stock",
      icon: Ban,
      action: onSetOutOfStock,
    },
    {
      label: "Change Category",
      icon: ArrowLeftRight,
      action: onChangeCategory,
    },
    {
      label: "Delete Selected",
      icon: Trash2,
      action: onDelete,
      variant: "destructive",
    }
  ]
}