/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import "./Auth.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFire } from "@fortawesome/free-solid-svg-icons";
import { QRCodeSVG } from "qrcode.react";
import { io } from "socket.io-client";
import { api } from "../services/api";
import { SOCKET_URL } from "../config";

interface AuthProps {
  onLoginSuccess: (user: { id: string; name: string; isGuest?: boolean }) => void;
}

type AuthStep = "email" | "phone" | "code" | "register";
type LoginMethod = "email" | "phone" | "qr";

const formatPhoneNumber = (value: string): string => {
  const cleaned = value.replace(/[^\d+]/g, "");
  
  if (cleaned.startsWith("+7") || cleaned.startsWith("7") || cleaned.startsWith("8")) {
    let digits = cleaned.replace(/^\+?7|^8/, "");
    digits = digits.replace(/\D/g, "").slice(0, 10);
    
    let formatted = "+7";
    if (digits.length > 0) {
      formatted += " (" + digits.slice(0, 3);
    }
    if (digits.length >= 4) {
      formatted += ") " + digits.slice(3, 6);
    }
    if (digits.length >= 7) {
      formatted += "-" + digits.slice(6, 8);
    }
    if (digits.length >= 9) {
      formatted += "-" + digits.slice(8, 10);
    }
    return formatted;
  }
  
  if (cleaned.startsWith("+")) {
    const digits = cleaned.slice(1).replace(/\D/g, "");
    if (digits.length === 0) return "+";
    if (digits.length <= 3) return `+${digits}`;
    if (digits.length <= 6) return `+${digits.slice(0, 3)} ${digits.slice(3)}`;
    if (digits.length <= 10) return `+${digits.slice(0, 3)} ${digits.slice(3, 6)}-${digits.slice(6)}`;
    return `+${digits.slice(0, 3)} ${digits.slice(3, 6)}-${digits.slice(6, 10)}-${digits.slice(10, 14)}`;
  }
  
  if (/^\d/.test(cleaned)) {
    return "+" + cleaned;
  }
  
  return cleaned;
};

const countries = [
  { name: "Kazakhstan", code: "+7" },
  { name: "Russia", code: "+7" },
  { name: "United States", code: "+1" },
  { name: "United Kingdom", code: "+44" },
  { name: "Germany", code: "+49" },
  { name: "France", code: "+33" },
  { name: "Ukraine", code: "+380" },
  { name: "Belarus", code: "+375" },
];

export const Auth: React.FC<AuthProps> = ({ onLoginSuccess }) => {
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("email");
  const [step, setStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+7");
  const [country, setCountry] = useState("Kazakhstan");
  const [code, setCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrToken, setQrToken] = useState("");

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setCountry(val);
    const found = countries.find((c) => c.name === val);
    if (found) {
      setPhone(found.code);
    }
  };

  useEffect(() => {
    if (loginMethod !== "qr" || (step !== "email" && step !== "phone")) return;

    let socket: any;

    const initQRLogin = async () => {
      try {
        setError("");
        const data = await api.auth.generateQrToken();
        setQrToken(data.token);

        socket = io(SOCKET_URL);

        socket.on("connect", () => {
          socket.emit("join_qr_room", data.token);
        });

        socket.on("qr_success", (authData: any) => {
          localStorage.setItem("accessToken", authData.accessToken);
          localStorage.setItem("refreshToken", authData.refreshToken);
          onLoginSuccess({
            id: authData.user.id,
            name: authData.user.firstName + (authData.user.lastName ? ` ${authData.user.lastName}` : ""),
            isGuest: false,
          });
        });
      } catch (err: any) {
        setError(err.message || "QR Code session error");
      }
    };

    initQRLogin();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [loginMethod, step, onLoginSuccess]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }

    setError("");
    setLoading(true);
    try {
      await api.auth.sendEmailOtp(email.trim());

      setStep("code");
      setCode("");
    } catch (err: any) {
      setError(err.message || "Server connection error");
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("Phone number login is temporarily unavailable. Please log in using Email.");
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 6) {
      setError("Please enter a 6-digit verification code");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const data = await api.auth.verifyEmailOtp(email.trim(), code);

      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);

      if (data.isNewUser) {
        setStep("register");
      } else {
        onLoginSuccess({
          id: data.user.id,
          name: data.user.firstName + (data.user.lastName ? ` ${data.user.lastName}` : ""),
          isGuest: false,
        });
      }
    } catch (err: any) {
      setError(err.message || "Server connection error");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      setError("First name is required");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const data = await api.auth.register({
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        username: username.trim() || undefined,
      });

      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);

      onLoginSuccess({
        id: data.user.id,
        name: data.user.firstName + (data.user.lastName ? ` ${data.user.lastName}` : ""),
        isGuest: false,
      });
    } catch (err: any) {
      setError(err.message || "Server connection error");
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const data = await api.auth.guest();

      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);

      onLoginSuccess({
        id: data.user.id,
        name: data.user.firstName + (data.user.lastName ? ` ${data.user.lastName}` : ""),
        isGuest: true,
      });
    } catch (err: any) {
      setError(err.message || "Server connection error");
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(val);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);

    const cleaned = formatted.replace(/[^\d+]/g, "");
    if (cleaned.startsWith("+7")) {
      if (country !== "Kazakhstan" && country !== "Russia") {
        setCountry("Kazakhstan");
      }
    } else if (cleaned.startsWith("+1")) {
      setCountry("United States");
    } else if (cleaned.startsWith("+44")) {
      setCountry("United Kingdom");
    } else if (cleaned.startsWith("+380")) {
      setCountry("Ukraine");
    } else if (cleaned.startsWith("+375")) {
      setCountry("Belarus");
    } else if (cleaned.startsWith("+49")) {
      setCountry("Germany");
    } else if (cleaned.startsWith("+33")) {
      setCountry("France");
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        {loginMethod !== "qr" || (step !== "email" && step !== "phone") ? (
          <div className="auth-logo-container">
            <div className="auth-logo-circle">
              <FontAwesomeIcon icon={faFire} style={{ fontSize: "56px", color: "#ffffff" }} />
            </div>
          </div>
        ) : null}

        {error && <div className="auth-error">{error}</div>}

        {(step === "email" || step === "phone") && (
          <>
            {loginMethod === "email" && (
              <form onSubmit={handleEmailSubmit} className="auth-form">
                <h2 className="auth-title">Sign in to Fire Talk</h2>
                <p className="auth-subtitle">Please enter your email address to log in.</p>

                <div className="auth-input-group">
                  <span className="auth-input-label">Email Address</span>
                  <input
                    type="email"
                    className="auth-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    autoFocus
                    disabled={loading}
                  />
                </div>

                <button type="submit" className="auth-submit-btn" disabled={loading}>
                  {loading ? "CHECKING..." : "NEXT"}
                </button>

                <div className="auth-bottom-links">
                  <button
                    type="button"
                    className="auth-link-btn-telegram"
                    onClick={() => {
                      setLoginMethod("phone");
                      setStep("phone");
                      setError("");
                    }}
                    disabled={loading}
                  >
                    LOG IN BY PHONE NUMBER
                  </button>
                  <button
                    type="button"
                    className="auth-link-btn-telegram"
                    onClick={() => {
                      setLoginMethod("qr");
                      setError("");
                    }}
                    disabled={loading}
                  >
                    LOG IN BY QR CODE
                  </button>
                  <button
                    type="button"
                    className="auth-link-btn-telegram guest-link"
                    onClick={handleGuestLogin}
                    disabled={loading}
                  >
                    LOG IN AS GUEST
                  </button>
                </div>
              </form>
            )}

            {loginMethod === "phone" && (
              <form onSubmit={handlePhoneSubmit} className="auth-form">
                <h2 className="auth-title">Sign in to Fire Talk</h2>
                <p className="auth-subtitle">Please confirm your country code and enter your phone number.</p>

                <div className="auth-input-group">
                  <span className="auth-input-label">Country</span>
                  <select className="auth-select" value={country} onChange={handleCountryChange}>
                    {countries.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                  <i className="fa-solid fa-chevron-down dropdown-chevron"></i>
                </div>

                <div className="auth-input-group">
                  <span className="auth-input-label">Phone Number</span>
                  <input
                    type="tel"
                    className="auth-input"
                    value={phone}
                    onChange={handlePhoneChange}
                    placeholder="+7 (999) 123-45-67"
                    required
                    autoFocus
                    disabled={loading}
                  />
                </div>

                <button type="submit" className="auth-submit-btn" disabled={loading}>
                  NEXT
                </button>

                <div className="auth-bottom-links">
                  <button
                    type="button"
                    className="auth-link-btn-telegram"
                    onClick={() => {
                      setLoginMethod("email");
                      setStep("email");
                      setError("");
                    }}
                    disabled={loading}
                  >
                    LOG IN BY EMAIL
                  </button>
                  <button
                    type="button"
                    className="auth-link-btn-telegram"
                    onClick={() => {
                      setLoginMethod("qr");
                      setError("");
                    }}
                    disabled={loading}
                  >
                    LOG IN BY QR CODE
                  </button>
                  <button
                    type="button"
                    className="auth-link-btn-telegram guest-link"
                    onClick={handleGuestLogin}
                    disabled={loading}
                  >
                    LOG IN AS GUEST
                  </button>
                </div>
              </form>
            )}

            {loginMethod === "qr" && (
              <div className="auth-form qr-container">
                <div className="qr-code-box">
                  {qrToken ? (
                    <QRCodeSVG
                      value={qrToken}
                      size={180}
                      level="M"
                      includeMargin={false}
                      style={{ borderRadius: "8px" }}
                    />
                  ) : (
                    <div style={{ color: "#aaa", fontSize: "14px" }}>Loading QR...</div>
                  )}
                </div>

                <h2 className="auth-title">Log in to Fire Talk by QR Code</h2>

                <ol className="qr-instructions">
                  <li>Open <strong>Fire Talk</strong> on your phone</li>
                  <li>Go to <strong>Settings</strong> › <strong>Devices</strong> › <strong>Link Desktop Device</strong></li>
                  <li>Point your phone at this screen to confirm login</li>
                </ol>

                <div className="auth-bottom-links">
                  <button
                    type="button"
                    className="auth-link-btn-telegram"
                    onClick={() => {
                      setLoginMethod("email");
                      setStep("email");
                      setError("");
                    }}
                    disabled={loading}
                  >
                    LOG IN BY EMAIL
                  </button>
                  <button
                    type="button"
                    className="auth-link-btn-telegram"
                    onClick={() => {
                      setLoginMethod("phone");
                      setStep("phone");
                      setError("");
                    }}
                    disabled={loading}
                  >
                    LOG IN BY PHONE NUMBER
                  </button>
                  <button
                    type="button"
                    className="auth-link-btn-telegram guest-link"
                    onClick={handleGuestLogin}
                    disabled={loading}
                  >
                    LOG IN AS GUEST
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {step === "code" && (
          <form onSubmit={handleCodeSubmit} className="auth-form">
            <h2 className="auth-title">Enter Code</h2>
            <p className="auth-subtitle">
              We have sent a verification code to <span className="highlight-text">{email}</span>
            </p>
            <p className="auth-spam-notice" style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "-12px", marginBottom: "20px", textAlign: "center" }}>
              Can't find the email? Please check your <strong>Spam</strong> or <strong>Junk</strong> folder.
            </p>

            <div className="auth-input-group">
              <span className="auth-input-label">Verification Code</span>
              <input
                type="text"
                className="auth-input"
                pattern="[0-9]*"
                inputMode="numeric"
                value={code}
                onChange={handleCodeChange}
                placeholder="Code"
                maxLength={6}
                required
                autoFocus
              />
            </div>

            <button type="submit" className="auth-submit-btn">
              VERIFY
            </button>

            <div className="auth-bottom-links">
              <button
                type="button"
                className="auth-link-btn-telegram"
                onClick={() => {
                  setStep("email");
                  setError("");
                  setCode("");
                }}
              >
                CHANGE EMAIL
              </button>
            </div>
          </form>
        )}

        {step === "register" && (
          <form onSubmit={handleRegisterSubmit} className="auth-form">
            <h2 className="auth-title">Your Name</h2>
            <p className="auth-subtitle">You do not have an account yet. Please enter your details to sign up.</p>

            <div className="auth-input-group">
              <span className="auth-input-label">First Name *</span>
              <input
                type="text"
                className="auth-input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                required
                autoFocus
                disabled={loading}
              />
            </div>

            <div className="auth-input-group">
              <span className="auth-input-label">Last Name (optional)</span>
              <input
                type="text"
                className="auth-input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                disabled={loading}
              />
            </div>

            <div className="auth-input-group">
              <span className="auth-input-label">Username (optional)</span>
              <input
                type="text"
                className="auth-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                disabled={loading}
              />
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? "REGISTERING..." : "START MESSAGING"}
            </button>

            <div className="auth-bottom-links">
              <button
                type="button"
                className="auth-link-btn-telegram"
                onClick={() => {
                  setStep("email");
                  setError("");
                }}
                disabled={loading}
              >
                CANCEL
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
