import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboard';
import { queryKeys } from '@/lib/react-query';

interface CategoryDistribution {
  category: string;
  items: number;
}

export function useCategoryChartData(minimumItems: number = 1) {
  // Validate input
  const validatedMinimumItems = minimumItems < 0 ? 1 : minimumItems;

  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: queryKeys.dashboard.categoryDistribution(validatedMinimumItems),
    queryFn: async () => {
      const response = await dashboardService.getCategoryDistribution(validatedMinimumItems);
      return response.data;
    },
    // React Query 5 Native Refetch Pattern
    refetchOnMount: 'always',
    staleTime: 0, // Force fresh data on dashboard load
    gcTime: 5 * 60 * 1000, // Maintain cache for navigation
    select: (data): CategoryDistribution[] => {
      // Extract categories array from aggregated response
      if (data && 'categories' in data) {
        return (data as any).categories.map((cat: any) => ({
          category: cat.categoryName,
          items: cat.itemCount
        }));
      }
      return [];
    },
  });

  return { 
    data: data || [], 
    isLoading, 
    error: error as Error | null,
    refetch
  };
}