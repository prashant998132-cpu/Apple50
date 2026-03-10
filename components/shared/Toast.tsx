'use client';
import React, { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type?: 'default' | 'ok' | 'err';
  onClose: () => void;
}

export function Toast({ message, type = 'default', onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  const cls = type === 'ok' ? 'toast toast-ok' : type === 'err' ? 'toast toast-err' : 'toast';
  return <div className={cls}>{message}</div>;
}

export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'default' | 'ok' | 'err' } | null>(null);
  const showToast = (message: string, type: 'default' | 'ok' | 'err' = 'default') => setToast({ message, type });
  const hideToast = () => setToast(null);
  return { toast, showToast, hideToast };
}
