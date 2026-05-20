import { FoodItem, FoodItemStatus } from '@/types/food-item';

export const FOOD_ITEM_STATUS_FILTERS: Array<{
  value: FoodItemStatus;
  label: string;
}> = [
  { value: 'out_of_stock', label: 'Out of Stock' },
  { value: 'in_stock', label: 'In Stock' },
  { value: 'clearance', label: 'Clearance' },
  { value: 'limited', label: 'Limited Supply' },
];

export function foodItemMatchesStatus(item: FoodItem, status: FoodItemStatus): boolean {
  switch (status) {
    case 'out_of_stock':
      return !item.statusFlags.isInStock;
    case 'in_stock':
      return item.statusFlags.isInStock;
    case 'clearance':
      return item.statusFlags.isInStock && item.statusFlags.isClearance;
    case 'limited':
      return item.statusFlags.isInStock && item.statusFlags.isLimited;
    default:
      return true;
  }
}

export function filterFoodItemsForInventoryUpdate(
  foodItems: FoodItem[],
  selectedCategoryIds: Set<number>,
  selectedStatuses: Set<FoodItemStatus>,
): FoodItem[] {
  return foodItems.filter((item) => {
    const categoryMatches = selectedCategoryIds.size === 0 || selectedCategoryIds.has(item.categoryId);
    const statusMatches = selectedStatuses.size === 0
      || Array.from(selectedStatuses).some((status) => foodItemMatchesStatus(item, status));

    return categoryMatches && statusMatches;
  });
}
