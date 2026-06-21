import React, { useState, useCallback, createContext, useContext, useRef, useEffect } from "react";
import "./Modal.css";

interface ModalConfig {
  message: string;
  type: "alert" | "confirm";
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  title?: string;
}

interface ModalContextValue {
  showAlert: (message: string, title?: string) => void;
  showConfirm: (
    message: string,
    onConfirm: () => void,
    options?: { confirmText?: string; cancelText?: string; danger?: boolean; title?: string }
  ) => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export const useModal = (): ModalContextValue => {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("useModal must be used inside ModalProvider");
  return ctx;
};

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<ModalConfig | null>(null);
  const [visible, setVisible] = useState(false);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setVisible(false);
    setTimeout(() => setConfig(null), 220);
  }, []);

  const showAlert = useCallback((message: string, title?: string) => {
    setConfig({ message, type: "alert", title });
    setVisible(true);
  }, []);

  const showConfirm = useCallback(
    (
      message: string,
      onConfirm: () => void,
      options?: { confirmText?: string; cancelText?: string; danger?: boolean; title?: string }
    ) => {
      setConfig({
        message,
        type: "confirm",
        onConfirm,
        confirmText: options?.confirmText ?? "Confirm",
        cancelText: options?.cancelText ?? "Cancel",
        danger: options?.danger ?? false,
        title: options?.title,
      });
      setVisible(true);
    },
    []
  );

  useEffect(() => {
    if (visible && confirmBtnRef.current) {
      confirmBtnRef.current.focus();
    }
  }, [visible]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && visible) close();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [visible, close]);

  return (
    <ModalContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      {config && (
        <div
          className={`modal-overlay ${visible ? "modal-overlay--visible" : ""}`}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              config.onCancel?.();
              close();
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className={`modal-card ${visible ? "modal-card--visible" : ""}`}>
            {config.title && (
              <h3 id="modal-title" className="modal-title">
                {config.title}
              </h3>
            )}
            <p className="modal-message">{config.message}</p>
            <div className="modal-actions">
              {config.type === "confirm" && (
                <button
                  type="button"
                  className="modal-btn modal-btn--cancel"
                  onClick={() => {
                    config.onCancel?.();
                    close();
                  }}
                >
                  {config.cancelText ?? "Cancel"}
                </button>
              )}
              <button
                ref={confirmBtnRef}
                type="button"
                className={`modal-btn ${config.danger ? "modal-btn--danger" : "modal-btn--primary"}`}
                onClick={() => {
                  config.onConfirm?.();
                  close();
                }}
              >
                {config.type === "alert" ? "OK" : (config.confirmText ?? "Confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
};
