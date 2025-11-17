# Redux Toolkit Setup

This project uses Redux Toolkit for state management. The setup includes:

## Structure

```
src/store/
├── index.ts          # Main store configuration
├── hooks.ts          # Typed hooks for TypeScript support
├── slices/
│   └── walletSlice.ts # Wallet form state management
└── README.md         # This file
```

## Usage

### 1. Using the custom hook (Recommended)

```typescript
import { useWalletForm } from '../hooks/useWalletForm';

const MyComponent = () => {
  const {
    formData,
    currentStep,
    updateField,
    updateSigner,
    addSigner,
    removeSigner,
    goToStep,
    reset
  } = useWalletForm();

  // Update a form field
  const handleNameChange = (value: string) => {
    updateField('walletName', value);
  };

  // Update signer address
  const handleSignerChange = (index: number, value: string) => {
    updateSigner(index, value);
  };

  // Add new signer
  const handleAddSigner = () => {
    addSigner();
  };

  // Remove signer
  const handleRemoveSigner = (index: number) => {
    removeSigner(index);
  };

  // Navigate to step
  const handleNextStep = () => {
    goToStep(currentStep + 1);
  };

  // Reset form
  const handleReset = () => {
    reset();
  };
};
```

### 2. Using Redux hooks directly

```typescript
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { updateFormField, setCurrentStep } from '../store/slices/walletSlice';

const MyComponent = () => {
  const dispatch = useAppDispatch();
  const { formData, currentStep } = useAppSelector((state) => state.wallet);

  const handleFieldChange = (field: string, value: string) => {
    dispatch(updateFormField({ field: field as any, value }));
  };

  const handleStepChange = (step: number) => {
    dispatch(setCurrentStep(step));
  };
};
```

## Available Actions

### Wallet Slice Actions

- `updateFormData(data)` - Update multiple form fields at once
- `updateFormField({ field, value })` - Update a single form field
- `updateSignerAddress({ index, value })` - Update a specific signer address
- `addSignerAddress()` - Add a new signer address
- `removeSignerAddress(index)` - Remove a signer address by index
- `setCurrentStep(step)` - Set the current step
- `resetForm()` - Reset all form data to initial state
- `setLoading(boolean)` - Set loading state
- `setError(message)` - Set error message

## State Structure

```typescript
interface WalletState {
  formData: {
    walletName: string;
    signatureThreshold: string;
    totalSigners: string;
    network: string;
    signerAddresses: string[];
  };
  currentStep: number;
  isLoading: boolean;
  error: string | null;
}
```

## Benefits of This Setup

1. **Type Safety**: Full TypeScript support with typed hooks
2. **Centralized State**: All wallet form data in one place
3. **Easy Testing**: Redux actions and reducers are pure functions
4. **DevTools**: Redux DevTools support for debugging
5. **Performance**: Optimized re-renders with useSelector
6. **Scalability**: Easy to add new slices and features 