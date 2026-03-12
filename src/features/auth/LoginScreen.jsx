import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  updateProfile
} from "firebase/auth";
import { useTranslation } from "react-i18next";
import { auth } from "../../firebase";
import AppLogo from "../../components/ui/AppLogo";
import Field from "../../components/ui/Field";
import LanguageSelector from "../../components/ui/LanguageSelector";
import { btnGoogle, btnP, globalCSS, inputS } from "../../constants/styles";
import { getAuthErrorMessage } from "./authErrors";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export default function LoginScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) {
      setError(t("auth.fillEmailAndPassword"));
      return;
    }

    if (isRegister && !name) {
      setError(t("auth.enterName"));
      return;
    }

    setError("");
    setLoading(true);

    try {
      if (isRegister) {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(credential.user, { displayName: name });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(getAuthErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  };

  const submitGoogle = async () => {
    setError("");
    setGoogleLoading(true);
    let redirectStarted = false;

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const shouldUseRedirect = [
        "auth/popup-blocked",
        "auth/operation-not-supported-in-this-environment"
      ].includes(err.code);

      if (shouldUseRedirect) {
        try {
          redirectStarted = true;
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr) {
          redirectStarted = false;
          setError(getAuthErrorMessage(redirectErr, t));
        }
      } else {
        setError(getAuthErrorMessage(err, t));
      }
    } finally {
      if (!redirectStarted) setGoogleLoading(false);
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24
      }}
    >
      <style>{globalCSS}</style>

      <div style={{ marginBottom: 16 }}>
        <AppLogo size={56} fontSize={20} />
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{t("common.appName")}</h1>
      <p style={{ fontSize: 11, color: "#95a8c0", marginBottom: 12 }}>
        {isRegister ? t("auth.registerSubtitle") : t("auth.loginSubtitle")}
      </p>
      <div style={{ marginBottom: 20 }}>
        <LanguageSelector compact />
      </div>

      <div style={{ width: "100%", maxWidth: 340 }}>
        {isRegister && (
          <Field label={t("auth.nameLabel")}>
            <input
              placeholder={t("auth.namePlaceholder")}
              value={name}
              onChange={(event) => setName(event.target.value)}
              style={inputS}
            />
          </Field>
        )}

        <Field label={t("auth.emailLabel")}>
          <input
            type="email"
            placeholder={t("auth.emailPlaceholder")}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            style={inputS}
            autoCapitalize="none"
          />
        </Field>

        <Field label={t("auth.passwordLabel")}>
          <input
            type="password"
            placeholder={t("auth.passwordPlaceholder")}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            style={inputS}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
          />
        </Field>

        {error && (
          <div
            style={{
              background: "#1a0808",
              border: "1px solid #3a1515",
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 12,
              color: "#f43",
              marginBottom: 14
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={loading || googleLoading}
          style={{ ...btnP, opacity: loading || googleLoading ? 0.5 : 1, marginBottom: 10 }}
        >
          {loading
            ? "..."
            : isRegister
              ? t("auth.createAccountButton")
              : t("auth.signInButton")}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1, height: 1, background: "#2a3d58" }} />
          <span
            style={{
              fontSize: 10,
              color: "#95a8c0",
              textTransform: "uppercase",
              letterSpacing: 1
            }}
          >
            {t("common.or")}
          </span>
          <div style={{ flex: 1, height: 1, background: "#2a3d58" }} />
        </div>

        <button
          onClick={submitGoogle}
          disabled={loading || googleLoading}
          style={{ ...btnGoogle, opacity: loading || googleLoading ? 0.5 : 1, marginBottom: 8 }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>G</span>
          <span>{googleLoading ? t("auth.connecting") : t("auth.continueWithGoogle")}</span>
        </button>

        <button
          onClick={() => {
            setIsRegister((previous) => !previous);
            setError("");
          }}
          style={{
            background: "transparent",
            border: "none",
            color: "#95a8c0",
            fontSize: 12,
            cursor: "pointer",
            width: "100%",
            padding: 10
          }}
        >
          {isRegister ? t("auth.switchToSignIn") : t("auth.switchToRegister")}
        </button>
      </div>
    </div>
  );
}
