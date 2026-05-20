import { vi } from 'vitest';

export const mockMessageService = {
  error: vi.fn(),
  show: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  retryableError: vi.fn(),
  systemError: vi.fn()
};

vi.mock('@/services/message', () => ({
  messageService: mockMessageService
}));

export const mockShowError = mockMessageService.error;

export const useMessage = () => ({
  showError: (message: string) => mockMessageService.error(message)
});

export const verifyToastMessage = (message: string, type?: 'success' | 'error' | 'info') => {
  if (type === 'error') {
    expect(mockShowError).toHaveBeenCalledWith(message, undefined);
  }
};

export const resetMessageMock = () => {
  mockShowError.mockClear();
};
