import { useState, useEffect } from 'react';
import { api } from './api';

export interface PendingUndoEntry {
  orderItemId: string;
  expiresAt: number;
  userId?: string;
  timeoutId: ReturnType<typeof setTimeout>;
  onFinalized?: () => void;
}

class ServedUndoManager {
  private pending = new Map<string, PendingUndoEntry>();
  private listeners = new Set<() => void>();

  constructor() {
    // 200ms background ticker to broadcast remaining countdown seconds to subscribed components
    setInterval(() => {
      if (this.pending.size > 0) {
        this.notify();
      }
    }, 200);
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.error('ServedUndoManager listener error:', e);
      }
    });
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public isPending(orderItemId: string): boolean {
    const entry = this.pending.get(orderItemId);
    if (!entry) return false;
    if (Date.now() >= entry.expiresAt) {
      return false;
    }
    return true;
  }

  public getRemainingSeconds(orderItemId: string): number | null {
    const entry = this.pending.get(orderItemId);
    if (!entry) return null;
    const diff = entry.expiresAt - Date.now();
    if (diff <= 0) return null;
    return Math.max(1, Math.ceil(diff / 1000));
  }

  public startUndo(
    orderItemId: string,
    userId?: string,
    onFinalized?: () => void
  ): void {
    // Clear any existing timer for this item
    const existing = this.pending.get(orderItemId);
    if (existing) {
      clearTimeout(existing.timeoutId);
    }

    const expiresAt = Date.now() + 5000;
    const timeoutId = setTimeout(async () => {
      this.pending.delete(orderItemId);
      this.notify();

      try {
        await api.updateOrderItemStatus(orderItemId, 'SERVED', userId);
        if (onFinalized) {
          onFinalized();
        }
        window.dispatchEvent(new CustomEvent('app:global-refresh'));
      } catch (err: any) {
        console.warn('Failed to commit SERVED on timeout:', err);
      }
    }, 5000);

    this.pending.set(orderItemId, {
      orderItemId,
      expiresAt,
      userId,
      timeoutId,
      onFinalized,
    });

    this.notify();
  }

  public cancelUndo(orderItemId: string): void {
    const entry = this.pending.get(orderItemId);
    if (entry) {
      clearTimeout(entry.timeoutId);
      this.pending.delete(orderItemId);
      this.notify();
    }
  }

  public getPendingIds(): string[] {
    const now = Date.now();
    const active: string[] = [];
    for (const [id, entry] of this.pending.entries()) {
      if (entry.expiresAt > now) {
        active.push(id);
      }
    }
    return active;
  }
}

export const servedUndoManager = new ServedUndoManager();

export function useServedUndo() {
  const [, setTick] = useState<number>(Date.now());

  useEffect(() => {
    return servedUndoManager.subscribe(() => {
      setTick(Date.now());
    });
  }, []);

  return {
    isPending: (id: string) => servedUndoManager.isPending(id),
    getRemainingSeconds: (id: string) => servedUndoManager.getRemainingSeconds(id),
    startUndo: (id: string, userId?: string, onFinalized?: () => void) =>
      servedUndoManager.startUndo(id, userId, onFinalized),
    cancelUndo: (id: string) => servedUndoManager.cancelUndo(id),
  };
}
