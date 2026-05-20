import { formatServiceCost } from './service-utils';

export function formatCostWithCents(
  value: number,
  options: { useCents?: boolean; threshold?: number } = {}
): string {
  const threshold = options.threshold ?? 0.10;
  const shouldUseCents = options.useCents ?? value < threshold;

  if (shouldUseCents) {
    return `${(value * 100).toFixed(3)}¢`;
  }

  return formatServiceCost(value);
}
