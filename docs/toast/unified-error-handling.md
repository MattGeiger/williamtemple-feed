# Unified Error Handling Architecture

## Core Principles

Error messages follow the ASK principle:
- **Actionable**: Tell users what to do
- **Specific**: Identify the exact problem  
- **Kind**: Use supportive language

## Central Message System

All error and status messages flow through the centralized Toast system located at `packages/frontend/src/contexts/ToastContext.tsx`.

### Message Types

```typescript
interface ToastMessage {
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}
```

## Error States vs System States

### True Error Conditions
- Database connection failures
- API endpoint unavailability
- Data corruption
- Authentication failures
- Network timeouts

### System Startup States
Conditions that indicate normal operation but empty datasets:
- Empty usage statistics with valid configurations present
- Fresh database with no user-generated content
- Missing cache data on first run

### Detection Logic

Startup conditions are identified by:
```typescript
const isStartupCondition = 
  hasValidLanguages && 
  hasValidCategories && 
  hasValidFoodItems && 
  hasValidConfigurations &&
  !hasUsageData;
```

## Error Message Patterns

### Avoid These Patterns
```typescript
// WRONG - Vague and unhelpful
"An error occurred"
"Something went wrong"  
"Failed to load data"
```

### Use These Patterns
```typescript
// CORRECT - Specific and actionable
"Unable to connect to database. Check your connection and try again."
"Food item name must be between 3-36 characters. Please shorten your entry."
"Category 'Dairy' cannot be deleted because 5 items are assigned. Reassign or delete the items first."
```

## Implementation Guidelines

### Backend Error Responses
```typescript
// Custom error classes with statusCode
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.statusCode = 400;
  }
}
```

### Frontend Error Handling
```typescript
// Use centralized message hook
const { showError, showSuccess } = useMessage();

try {
  await apiCall();
  showSuccess('Operation completed successfully');
} catch (error) {
  showError(error.message || 'Operation failed');
}
```

### Validation vs. Warning (ASK-aligned)

For inputs like API keys, prefer non-blocking warnings when the value looks unusual but not definitively invalid:

```typescript
const { showMessage } = useMessage()
const result = validateApiKeyForService(apiKey, serviceType)
if (result.warning) {
  showMessage(result.warning, 'warning')
}
```

Only block on clearly invalid states (e.g., empty required field). This keeps users unblocked while still guiding them to correct issues.

### Service Layer Error Propagation
```typescript
// Services should throw descriptive errors
export class CategoryService {
  async deleteCategory(id: number) {
    try {
      const result = await api.delete(`/categories/${id}`);
      return result;
    } catch (error) {
      if (error.status === 409) {
        throw new Error('Category cannot be deleted because food items are still assigned');
      }
      throw new Error('Failed to delete category. Please try again.');
    }
  }
}
```

## Dashboard Specific Handling

Dashboard metrics distinguish between:

### Missing Usage Data (Normal)
- Display zero values
- Show "No usage data yet" states
- Provide helpful context about new installations

### System Failures (Error)
- API connection issues
- Database unavailability  
- Configuration corruption

## Testing Error States

Error handling tests should verify:
- Correct error message content
- Appropriate error codes
- Toast message appearance
- User-facing corrective actions
- Recovery mechanisms
