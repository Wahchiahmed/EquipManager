// src/pages/admin/AdminShared.tsx
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export const ConfirmDialog: React.FC<{
  message: string; onConfirm: () => void; onCancel: () => void; danger?: boolean;
}> = ({ message, onConfirm, onCancel, danger }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
    <div className="bg-card border border-border rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
      <div className="flex items-start gap-3 mb-4">
        <AlertTriangle className={`w-5 h-5 mt-0.5 shrink-0 ${danger ? 'text-status-rejected' : 'text-amber-500'}`} />
        <p className="text-sm text-foreground">{message}</p>
      </div>
      <div className="flex gap-3 justify-end">
        <button onClick={onCancel} className="px-4 py-2 text-xs font-semibold rounded-lg border border-border hover:bg-muted">
          Annuler
        </button>
        <button
          onClick={onConfirm}
          className={`px-4 py-2 text-xs font-semibold rounded-lg text-white ${danger ? 'bg-status-rejected hover:bg-red-700' : 'bg-primary hover:bg-primary-hover'}`}
        >
          Confirmer
        </button>
      </div>
    </div>
  </div>
);

export const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({
  label, required, children,
}) => (
  <div>
    <label className="block text-xs font-medium text-foreground mb-1.5">
      {label}{required && ' *'}
    </label>
    {children}
  </div>
);

export const PageHeader: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div>
    <h1 className="text-2xl font-bold text-foreground">{title}</h1>
    {subtitle && <p className="text-muted-foreground text-sm mt-0.5">{subtitle}</p>}
  </div>
);

export const LoadingSpinner: React.FC<{ label?: string }> = ({ label = 'Chargement...' }) => (
  <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
    <div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
    <span className="text-sm">{label}</span>
  </div>
);

export const ErrorBanner: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => (
  <div className="flex items-start gap-2 text-xs text-status-rejected bg-status-rejected-bg border border-status-rejected/30 px-3 py-2.5 rounded-lg">
    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
    {message}
    <button onClick={onClose} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
  </div>
);