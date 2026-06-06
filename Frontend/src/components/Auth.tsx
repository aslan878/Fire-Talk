/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import { useAuth, useUser, useSignIn, useSignUp, useClerk } from "@clerk/clerk-react";
import "./Auth.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFire, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { QRCodeSVG } from "qrcode.react";
import { io } from "socket.io-client";
import { api } from "../services/api";
import { SOCKET_URL } from "../config";

interface AuthProps {
  onLoginSuccess: (user: { id: string; name: string; isGuest?: boolean }) => void;
}

type AuthStep = "email" | "phone" | "code" | "register" | "complete-profile";
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
  const { isSignedIn, user: clerkUser } = useUser();
  const { getToken } = useAuth();
  const { isLoaded: isSignInLoaded, signIn, setActive } = useSignIn();
  const { isLoaded: isSignUpLoaded, signUp } = useSignUp();
  const { signOut } = useClerk();

  const [loginMethod, setLoginMethod] = useState<LoginMethod>("email");
  const [step, setStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+7");
  const [country, setCountry] = useState("Kazakhstan");
  const [code, setCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [isSigningUp, setIsSigningUp] = useState(false);

  // Temporary user data saved during OAuth profile completion
  const [tempUser, setTempUser] = useState<{ id: string; name: string; accessToken: string; refreshToken: string } | null>(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrToken, setQrToken] = useState("");

  // Sync session with the backend database on successful sign-in
  useEffect(() => {
    const authenticateWithBackend = async () => {
      if (!isSignedIn || !clerkUser) return;

      // Don't re-trigger if already on the profile completion step
      if (step === "complete-profile") return;

      setLoading(true);
      setError("");

      try {
        const token = await getToken();
        if (!token) {
          throw new Error("Could not retrieve Clerk session token");
        }

        const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/auth/clerk`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to sync session with server");
        }

        // Save backend access tokens
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);

        // If this is a new user or they have no username, prompt for profile completion
        if (data.isNewUser || !data.user.username) {
          setFirstName(data.user.firstName || "");
          setLastName(data.user.lastName || "");
          setUsername(data.user.username || "");
          setBio(data.user.bio || "");
          setTempUser({
            id: data.user.id,
            name: data.user.firstName + (data.user.lastName ? ` ${data.user.lastName}` : ""),
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
          });
          setStep("complete-profile");
        } else {
          onLoginSuccess({
            id: data.user.id,
            name: data.user.firstName + (data.user.lastName ? ` ${data.user.lastName}` : ""),
            isGuest: false,
          });
        }
      } catch (err: any) {
        console.error("Backend auth sync error:", err);
        setError(err.message || "Failed to log in with our server. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    authenticateWithBackend();
  }, [isSignedIn, clerkUser, getToken, onLoginSuccess, step]);

  // QR Code Login initialization
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

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setCountry(val);
    const found = countries.find((c) => c.name === val);
    if (found) {
      setPhone(found.code);
    }
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
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    setCode(val);
  };

  // Programmatic Clerk Email sign-in / sign-up initiation
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignInLoaded || !isSignUpLoaded || !signIn || !signUp) return;
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // First attempt to sign in
      const signInAttempt = await (signIn.create as any)({
        identifier: email.trim(),
      });

      const emailCodeFactor = signInAttempt.supportedFirstFactors?.find(
        (factor: any) => factor.strategy === "email_code"
      );

      if (emailCodeFactor) {
        await signIn.prepareFirstFactor({
          strategy: "email_code",
          emailAddressId: (emailCodeFactor as any).emailAddressId,
        });
        setIsSigningUp(false);
        setStep("code");
        setCode("");
      } else {
        throw new Error("Email code sign-in is not supported on this account.");
      }
    } catch (err: any) {
      // If user doesn't exist, transition to sign-up flow instead
      if (err.errors?.[0]?.code === "form_identifier_not_found") {
        try {
          const signUpAttempt = await signUp.create({
            emailAddress: email.trim(),
          });
          await signUpAttempt.prepareEmailAddressVerification({
            strategy: "email_code",
          });
          setIsSigningUp(true);
          setStep("code");
          setCode("");
        } catch (signUpErr: any) {
          setError(signUpErr.errors?.[0]?.message || "Failed to send code. Please try again.");
        }
      } else {
        setError(err.errors?.[0]?.message || "Failed to initiate sign in.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Programmatic Clerk Phone sign-in / sign-up initiation
  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignInLoaded || !isSignUpLoaded || !signIn || !signUp) return;
    if (!phone.trim() || phone.trim() === countries.find(c => c.name === country)?.code) {
      setError("Please enter your phone number");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const signInAttempt = await signIn.create({
        identifier: phone.trim(),
      });

      const phoneCodeFactor = signInAttempt.supportedFirstFactors?.find(
        (factor: any) => factor.strategy === "phone_code"
      );

      if (phoneCodeFactor) {
        await signIn.prepareFirstFactor({
          strategy: "phone_code",
          phoneNumberId: (phoneCodeFactor as any).phoneNumberId,
        });
        setIsSigningUp(false);
        setStep("code");
        setCode("");
      } else {
        throw new Error("SMS code sign-in is not supported on this account.");
      }
    } catch (err: any) {
      if (err.errors?.[0]?.code === "form_identifier_not_found") {
        try {
          const signUpAttempt = await signUp.create({
            phoneNumber: phone.trim(),
          });
          await signUpAttempt.preparePhoneNumberVerification({
            strategy: "phone_code",
          });
          setIsSigningUp(true);
          setStep("code");
          setCode("");
        } catch (signUpErr: any) {
          setError(signUpErr.errors?.[0]?.message || "Failed to send verification SMS.");
        }
      } else {
        setError(err.errors?.[0]?.message || "Failed to send verification SMS.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Programmatic verification code verification
  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignInLoaded || !isSignUpLoaded || !signIn || !signUp || !setActive) return;
    if (!code) {
      setError("Please enter the verification code");
      return;
    }

    setError("");
    setLoading(true);

    try {
      if (isSigningUp) {
        // Verify sign-up OTP
        const result = loginMethod === "email"
          ? await signUp.attemptEmailAddressVerification({ code })
          : await signUp.attemptPhoneNumberVerification({ code });

        if (result.status === "complete") {
          await setActive({ session: result.createdSessionId });
        } else {
          // If profile fields are required, show register step
          setStep("register");
        }
      } else {
        // Verify sign-in OTP
        const result = await signIn.attemptFirstFactor({
          strategy: loginMethod === "email" ? "email_code" : "phone_code",
          code,
        });

        if (result.status === "complete") {
          await setActive({ session: result.createdSessionId });
        } else {
          setError("Session completion pending. Contact support.");
        }
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || "Invalid verification code.");
    } finally {
      setLoading(false);
    }
  };

  // Complete sign-up profile information
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignUpLoaded || !signUp || !setActive) return;
    if (!firstName.trim()) {
      setError("First Name is required");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const result = await signUp.update({
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        username: username.trim() || undefined,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
      } else {
        setError("Sign-up is not fully completed. Details are missing.");
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || "Failed to submit registration.");
    } finally {
      setLoading(false);
    }
  };

  // Social redirects
  const handleOAuthLogin = async (strategy: "oauth_google" | "oauth_apple") => {
    if (!signIn) return;
    try {
      setError("");
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/",
      });
    } catch (err: any) {
      setError(err.errors?.[0]?.message || "Social login failed.");
    }
  };

  // Profile completion for OAuth sign-ups
  const handleProfileCompletionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempUser) return;

    if (!firstName.trim()) {
      setError("First name is required");
      return;
    }

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setError("Nickname (username) is required");
      return;
    }
    if (trimmedUsername.length < 5 || trimmedUsername.length > 32) {
      setError("Nickname must be between 5 and 32 characters");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/users/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tempUser.accessToken}`,
          "x-user-id": tempUser.id,
        },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          username: trimmedUsername,
          bio: bio.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      onLoginSuccess({
        id: tempUser.id,
        name: firstName.trim() + (lastName.trim() ? ` ${lastName.trim()}` : ""),
        isGuest: false,
      });
    } catch (err: any) {
      setError(err.message || "Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelProfileCompletion = async () => {
    setTempUser(null);
    setStep("email");
    setError("");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    try {
      await signOut();
    } catch (e) {
      console.error("Sign out error:", e);
    }
  };

  // Guest login
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
      setError(err.message || "Guest login connection error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        {step !== "register" && step !== "complete-profile" && (
          <div className="auth-logo-section">
            <div className="auth-logo-circle">
              <FontAwesomeIcon icon={faFire} className="auth-logo-icon" />
            </div>
            <h1 className="auth-brand-name">
              {step === "code" ? "Enter Code" : "Sign in to Fire Talk"}
            </h1>
            <p className="auth-brand-tagline">
              {step === "code"
                ? `We have sent a verification code to ${loginMethod === "email" ? email : phone}`
                : loginMethod === "phone"
                  ? "Please confirm your country code and enter your phone number."
                  : "Please enter your email address to log in."
              }
            </p>
          </div>
        )}

        {error && <div className="auth-error">{error}</div>}

        {/* Required for Clerk custom flows Bot Protection / CAPTCHA */}
        <div id="clerk-captcha" />

        {loading && (
          <div className="auth-loading-container">
            <div className="auth-spinner"></div>
            <p className="auth-loading-text">Processing...</p>
          </div>
        )}

        {!loading && (
          <>
            {step === "email" && loginMethod === "email" && (
              <form onSubmit={handleEmailSubmit} className="auth-form">
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
                  />
                </div>

                <button type="submit" className="auth-submit-btn">
                  NEXT
                </button>

                {/* Custom Social Google & Apple Buttons */}
                <div className="auth-social-container">
                  <button
                    type="button"
                    className="auth-social-btn google-btn"
                    onClick={() => handleOAuthLogin("oauth_google")}
                  >
                    <svg className="social-svg-icon" viewBox="0 0 48 48" width="20" height="20">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                    Continue with Google
                  </button>
                  <button
                    type="button"
                    className="auth-social-btn apple-btn"
                    onClick={() => handleOAuthLogin("oauth_apple")}
                  >
                    <svg className="social-svg-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.21.67-2.93 1.49-.62.69-1.16 1.84-1.01 2.96 1.12.09 2.27-.56 2.95-1.39z" />
                    </svg>
                    Continue with Apple
                  </button>
                </div>

                <div className="auth-bottom-links">
                  <button
                    type="button"
                    className="auth-link-btn-telegram"
                    onClick={() => {
                      setLoginMethod("qr");
                      setError("");
                    }}
                  >
                    LOG IN BY QR CODE
                  </button>
                  <button
                    type="button"
                    className="auth-link-btn-telegram guest-link"
                    onClick={handleGuestLogin}
                  >
                    LOG IN AS GUEST
                  </button>
                </div>
              </form>
            )}

            {step === "phone" && loginMethod === "phone" && (
              <form onSubmit={handlePhoneSubmit} className="auth-form">
                <div className="auth-input-group">
                  <span className="auth-input-label">Country</span>
                  <select className="auth-select" value={country} onChange={handleCountryChange}>
                    {countries.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <FontAwesomeIcon icon={faChevronDown} className="dropdown-chevron" />
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
                  />
                </div>

                <button type="submit" className="auth-submit-btn">
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
                  >
                    LOG IN BY QR CODE
                  </button>
                  <button
                    type="button"
                    className="auth-link-btn-telegram guest-link"
                    onClick={handleGuestLogin}
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
                  >
                    LOG IN BY PHONE NUMBER
                  </button>
                  <button
                    type="button"
                    className="auth-link-btn-telegram guest-link"
                    onClick={handleGuestLogin}
                  >
                    LOG IN AS GUEST
                  </button>
                </div>
              </div>
            )}

            {step === "code" && (
              <form onSubmit={handleCodeSubmit} className="auth-form">
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
                      setStep(loginMethod === "email" ? "email" : "phone");
                      setError("");
                      setCode("");
                    }}
                  >
                    {loginMethod === "email" ? "CHANGE EMAIL" : "CHANGE PHONE NUMBER"}
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
                  />
                </div>

                <button type="submit" className="auth-submit-btn">
                  START MESSAGING
                </button>

                <div className="auth-bottom-links">
                  <button
                    type="button"
                    className="auth-link-btn-telegram"
                    onClick={() => {
                      setStep(loginMethod === "email" ? "email" : "phone");
                      setError("");
                    }}
                  >
                    CANCEL
                  </button>
                </div>
              </form>
            )}

            {step === "complete-profile" && (
              <form onSubmit={handleProfileCompletionSubmit} className="auth-form">
                <div className="auth-logo-section">
                  <div className="auth-logo-circle">
                    <FontAwesomeIcon icon={faFire} className="auth-logo-icon" />
                  </div>
                  <h1 className="auth-brand-name">Complete Your Profile</h1>
                  <p className="auth-brand-tagline">
                    Please fill in your details to get started with Fire Talk.
                  </p>
                </div>

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
                  />
                </div>

                <div className="auth-input-group">
                  <span className="auth-input-label">Nickname *</span>
                  <input
                    type="text"
                    className="auth-input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="your_nickname"
                    required
                    minLength={5}
                    maxLength={32}
                  />
                  <span className="auth-input-hint" style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>5–32 characters</span>
                </div>

                <div className="auth-input-group">
                  <span className="auth-input-label">Bio (optional)</span>
                  <input
                    type="text"
                    className="auth-input"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="A few words about yourself"
                    maxLength={70}
                  />
                  <span className="auth-input-hint" style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>{bio.length}/70</span>
                </div>

                <button type="submit" className="auth-submit-btn">
                  START MESSAGING
                </button>

                <div className="auth-bottom-links">
                  <button
                    type="button"
                    className="auth-link-btn-telegram"
                    onClick={handleCancelProfileCompletion}
                  >
                    CANCEL
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};
