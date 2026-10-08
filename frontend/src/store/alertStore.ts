import { create } from 'zustand';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface AlertOptions {
  title: string;
  message: string;
  type?: AlertType;
  buttons?: AlertButton[];
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

interface AlertState {
  visible: boolean;
  options: AlertOptions | null;
  showAlert: (options: AlertOptions) => void;
  hideAlert: () => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  visible: false,
  options: null,
  showAlert: (options: AlertOptions) => {
    set({ visible: true, options });
  },
  hideAlert: () => {
    set({ visible: false, options: null });
  },
}));

/**
 * Global helper function to trigger the sleek modern alert popup from anywhere
 */
export const showCustomAlert = (
  title: string,
  message: string,
  type: AlertType = 'info',
  buttons?: AlertButton[]
) => {
  useAlertStore.getState().showAlert({
    title,
    message,
    type,
    buttons,
  });
};
