import React, { useEffect, useState } from "react";
import { SignIn, useAuth, useUser } from "@clerk/clerk-react";
import "./Auth.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFire } from "@fortawesome/free-solid-svg-icons";

interface AuthProps {
  onLoginSuccess: (user: { id: string; name: string; isGuest?: boolean }) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLoginSuccess }) => {
  const { isSignedIn, user: clerkUser } = useUser();
  const { getToken } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const authenticateWithBackend = async () => {
      if (!isSignedIn || !clerkUser) return;

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

        // Save backend access token
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);

        onLoginSuccess({
          id: data.user.id,
          name: data.user.firstName + (data.user.lastName ? ` ${data.user.lastName}` : ""),
          isGuest: false,
        });
      } catch (err: any) {
        console.error("Backend auth sync error:", err);
        setError(err.message || "Failed to log in with our server. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    authenticateWithBackend();
  }, [isSignedIn, clerkUser, getToken, onLoginSuccess]);

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo-container">
          <div className="auth-logo-circle">
            <FontAwesomeIcon icon={faFire} style={{ fontSize: "56px", color: "#ffffff" }} />
          </div>
        </div>

        {error && <div className="auth-error">{error}</div>}

        {loading ? (
          <div className="auth-loading-container">
            <div className="auth-spinner"></div>
            <p className="auth-loading-text">Igniting session on server...</p>
          </div>
        ) : (
          <div className="clerk-signin-wrapper">
            <SignIn
              appearance={{
                variables: {
                  colorPrimary: "#ec3333", // Match the fire logo red
                  colorBackground: "#181818", // Dark theme background
                  colorText: "#ffffff",
                  colorTextSecondary: "#aaaaaa",
                  colorInputBackground: "#242424",
                  colorInputText: "#ffffff",
                  colorBorder: "#303030",
                },
                elements: {
                  cardBox: "clerk-custom-card-box",
                  card: "clerk-custom-card",
                  headerTitle: "clerk-custom-title",
                  headerSubtitle: "clerk-custom-subtitle",
                  socialButtonsBlockButton: "clerk-social-btn",
                  formButtonPrimary: "clerk-submit-btn",
                  footerActionLink: "clerk-footer-link",
                  formFieldLabel: "clerk-field-label",
                  formFieldInput: "clerk-field-input",
                  dividerText: "clerk-divider-text",
                  dividerLine: "clerk-divider-line",
                  identityPreviewText: "clerk-identity-text",
                  identityPreviewEditButton: "clerk-identity-edit"
                }
              }}
              routing="hash"
            />
          </div>
        )}
      </div>
    </div>
  );
};
