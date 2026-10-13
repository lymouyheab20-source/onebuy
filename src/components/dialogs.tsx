import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import { Modal, Toast } from './ui';

interface Dialogs {
  /** In-page replacement for window.confirm(), which embedded/hosted views may block. */
  ask(message: string, opts?: { danger?: boolean }): Promise<boolean>;
  /** In-page replacement for window.alert(). */
  notify(message: string): void;
}

const Ctx = createContext<Dialogs | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [pending, setPending] = useState<{ message: string; danger: boolean } | null>(null);
  const [toast, setToast] = useState('');
  const resolver = useRef<(ok: boolean) => void>();

  const ask = useCallback((message: string, opts?: { danger?: boolean }) => {
    setPending({ message, danger: opts?.danger ?? true });
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = undefined;
    setPending(null);
  };

  return (
    <Ctx.Provider value={{ ask, notify: setToast }}>
      {children}
      {pending && (
        <Modal
          title={pending.message}
          onClose={() => close(false)}
          footer={
            <>
              <button className="btn ghost" onClick={() => close(false)}>{t('cancel')}</button>
              <button className={`btn ${pending.danger ? 'danger-solid' : 'primary'}`} onClick={() => close(true)} autoFocus>{t('confirm')}</button>
            </>
          }
        >
          <p className="muted">{t('cannotUndo')}</p>
        </Modal>
      )}
      {toast && <Toast message={toast} onDone={() => setToast('')} />}
    </Ctx.Provider>
  );
}

export function useDialogs(): Dialogs {
  const d = useContext(Ctx);
  if (!d) throw new Error('useDialogs must be used inside DialogProvider');
  return d;
}
