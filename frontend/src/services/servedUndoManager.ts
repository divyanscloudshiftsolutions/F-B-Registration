import { useState, useEffect } from 'react';
import { api } from './api';

interface PendingServedItem {
  orderItemId: string;
  staffId?: string;
  expiresAt: number;
  onCommitted?: () => void;
}

class ServedUndoService {
  private pendingMap = new Map<string, PendingServedItem>();
  private listeners = new Set<() => void>();
  private ticker: NodeJS.Timeout | null = null;

  constructor() {
    this.startTicker();
  }

  private startTicker() {
    if (this.ticker) return;
    this.ticker = setInterval(() => {
      const now = Date.now();
      let hasChanges = false;

      this.pendingMap.forEach((item, id) => {
        if (now >= item.expiresAt) {
          // Time expired -> Commit SERVED status to backend
          this.commitServed(item);
          this.pendingMap.delete(id);
          hasChanges = true;
        }
      });

      if (hasChanges || this.pendingMap.size > 0) {
        this.notify();
      }
    }, 200);
  }

  private async commitServed(item: PendingServedItem) {
    try {
      await api.updateOrderItemStatus(item.orderItemId, 'SERVED', item.staffId);
      if (item.onCommitted) {
        item.onCommitted();
      }
    } catch (err) {
      console.warn('[ServedUndo] Failed to commit SERVED status:', err);
    }
  }

  public startUndo(orderItemId: string, staffId?: string, onCommitted?: () => void) {
    const expiresAt = Date.now() + 5000; // 5000ms countdown
    this.pendingMap.set(orderItemId, {
      orderItemId,
      staffId,
      expiresAt,
      onCommitted,
    });
    this.notify();
  }

  public cancelUndo(orderItemId: string) {
    if (this.pendingMap.has(orderItemId)) {
      this.pendingMap.delete(orderItemId);
      this.notify();
    }
  }

  public isPending(orderItemId: string): boolean {
    return this.pendingMap.has(orderItemId);
  }

  public getRemainingSeconds(orderItemId: string): number {
    const item = this.pendingMap.get(orderItemId);
    if (!item) return 0;
    const diff = item.expiresAt - Date.now();
    return Math.max(0, Math.ceil(diff / 1000));
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }
}

export const servedUndoManager = new ServedUndoService();

export const useServedUndo = () => {
  const [, setTick] = useState(0);

  useEffect(() => {
    return servedUndoManager.subscribe(() => setTick((t) => t + 1));
  }, []);

  return {
    isPending: (id: string) => servedUndoManager.isPending(id),
    getRemainingSeconds: (id: string) => servedUndoManager.getRemainingSeconds(id),
    startUndo: (id: string, staffId?: string, onCommitted?: () => void) =>
      servedUndoManager.startUndo(id, staffId, onCommitted),
    cancelUndo: (id: string) => servedUndoManager.cancelUndo(id),
  };
};
