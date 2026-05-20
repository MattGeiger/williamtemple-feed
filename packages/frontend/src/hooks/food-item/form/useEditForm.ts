import { useState, useEffect } from 'react';
import { 
  FoodItem, 
  FoodItemStatus, 
  NutritionalFlags, 
  StatusFlags,
  DEFAULT_NUTRITIONAL_FLAGS,
  OUT_OF_STOCK_FLAGS
} from '@/types/food-item';
import { createFormattedChangeHandler, validateMinLength } from '@/lib/formatting/text';

interface EditFormState {
  name: string;
  limit: string;
  categoryId: string;
  statusFlags: StatusFlags;
  nutritionalFlags: NutritionalFlags;
  showValidation: boolean;
  validationError: string | null;
}

interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export function useEditForm(initialData?: FoodItem | null) {
  const [formState, setFormState] = useState<EditFormState>(() => ({
    name: initialData?.name ?? '',
    limit: initialData?.limit === 100 ? 'no-limit' : initialData?.limit.toString() ?? 'no-limit',
    categoryId: initialData?.categoryId.toString() ?? '',
    statusFlags: initialData ? {
      isInStock: initialData.status === 'in_stock',
      isLimited: initialData.status === 'limited',
      isClearance: initialData.status === 'clearance'
    } : OUT_OF_STOCK_FLAGS,
    nutritionalFlags: initialData?.nutritionalFlags ?? { ...DEFAULT_NUTRITIONAL_FLAGS },
    showValidation: false,
    validationError: null
  }));

  // Reset form when initialData changes
  useEffect(() => {
    if (initialData) {
      setFormState({
        name: initialData.name,
        limit: initialData.limit === 100 ? 'no-limit' : initialData.limit.toString(),
        categoryId: initialData.categoryId.toString(),
        statusFlags: {
          isInStock: initialData.status === 'in_stock',
          isLimited: initialData.status === 'limited',
          isClearance: initialData.status === 'clearance'
        },
        nutritionalFlags: initialData.nutritionalFlags,
        showValidation: false,
        validationError: null
      });
    }
  }, [initialData]);

  const validateStatusFlags = (flags: StatusFlags): ValidationResult => {
    const activeFlags = [flags.isInStock, flags.isLimited, flags.isClearance]
      .filter(Boolean).length;

    if (activeFlags > 1) {
      return {
        isValid: false,
        error: 'Only one status flag can be active at a time'
      };
    }

    return { isValid: true };
  };

  const handleNameChange = createFormattedChangeHandler((value: string) => {
    setFormState(prev => {
      const newState = {
        ...prev,
        name: value
      };
      
      if (prev.showValidation) {
        if (!validateMinLength(value)) {
          return {
            ...newState,
            validationError: 'Food item name must be at least 3 characters'
          };
        }
        return {
          ...newState,
          validationError: null
        };
      }
      return newState;
    });
  }, { maxLength: 36 });

  const handleLimitChange = (value: string) => {
    setFormState(prev => ({
      ...prev,
      limit: value
    }));
  };

  const handleCategoryChange = (value: string) => {
    setFormState(prev => ({
      ...prev,
      categoryId: value,
      validationError: null
    }));
  };

  const handleStatusFlagsChange = (newFlags: StatusFlags) => {
    const validation = validateStatusFlags(newFlags);
    
    if (!validation.isValid) {
      setFormState(prev => ({
        ...prev,
        validationError: validation.error
      }));
      return;
    }

    setFormState(prev => ({
      ...prev,
      statusFlags: newFlags,
      validationError: null
    }));
  };

  const handleNutritionalFlagChange = (flag: keyof NutritionalFlags) => {
    setFormState(prev => ({
      ...prev,
      nutritionalFlags: {
        ...prev.nutritionalFlags,
        [flag]: !prev.nutritionalFlags[flag]
      }
    }));
  };

  const validateForm = () => {
    setFormState(prev => ({
      ...prev,
      showValidation: true
    }));

    if (!validateMinLength(formState.name)) {
      setFormState(prev => ({
        ...prev,
        validationError: 'Food item name must be at least 3 characters'
      }));
      return false;
    }

    if (!formState.categoryId) {
      setFormState(prev => ({
        ...prev,
        validationError: 'Please select a category'
      }));
      return false;
    }

    const statusValidation = validateStatusFlags(formState.statusFlags);
    if (!statusValidation.isValid) {
      setFormState(prev => ({
        ...prev,
        validationError: statusValidation.error
      }));
      return false;
    }

    return true;
  };

  const getFormData = () => {
    const limit = formState.limit === 'no-limit' ? 100 : parseInt(formState.limit, 10);
    const hasNoFlags = !formState.statusFlags.isInStock && 
                      !formState.statusFlags.isLimited && 
                      !formState.statusFlags.isClearance;

    return {
      name: formState.name.trim(),
      limit,
      categoryId: parseInt(formState.categoryId, 10),
      statusFlags: formState.statusFlags,
      nutritionalFlags: formState.nutritionalFlags,
      status: hasNoFlags ? 'out_of_stock' as FoodItemStatus :
              formState.statusFlags.isInStock ? 'in_stock' as FoodItemStatus :
              formState.statusFlags.isLimited ? 'limited' as FoodItemStatus :
              'clearance' as FoodItemStatus
    };
  };

  return {
    ...formState,
    handleNameChange,
    handleLimitChange,
    handleCategoryChange,
    handleStatusFlagsChange,
    handleNutritionalFlagChange,
    validateForm,
    getFormData
  };
}