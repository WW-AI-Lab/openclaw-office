import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";
import { useAuthStore } from "@/store/auth-store";

export function LoginGate() {
  const { t } = useTranslation("auth");
  const gatewayUrlInit = useAuthStore((s) => s.gatewayUrl);
  const tokenInit = useAuthStore((s) => s.token);
  const passwordInit = useAuthStore((s) => s.password);
  const rememberInit = useAuthStore((s) => s.rememberCredentials);
  const authStatus = useAuthStore((s) => s.authStatus);
  const authError = useAuthStore((s) => s.authError);
  const submitLogin = useAuthStore((s) => s.submitLogin);

  const [gatewayUrl, setGatewayUrl] = useState(gatewayUrlInit);
  const [token, setToken] = useState(tokenInit);
  const [password, setPassword] = useState(passwordInit);
  const [remember, setRemember] = useState(rememberInit);
  const [showToken, setShowToken] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isAuthenticating = authStatus === "authenticating";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAuthenticating) {
      return;
    }
    submitLogin(
      {
        gatewayUrl: gatewayUrl.trim(),
        token: token.trim(),
        password: password.trim(),
      },
      remember,
    );
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-950">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-xl dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("subtitle")}</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("fields.gatewayUrl")}
            </span>
            <input
              type="text"
              value={gatewayUrl}
              onChange={(e) => setGatewayUrl(e.target.value)}
              placeholder="ws://127.0.0.1:18789"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </label>

          <SecretField
            label={t("fields.token")}
            value={token}
            onChange={setToken}
            visible={showToken}
            onToggle={() => setShowToken((v) => !v)}
            placeholder={t("fields.tokenPlaceholder")}
            showLabel={t("toggle.show")}
            hideLabel={t("toggle.hide")}
          />

          <SecretField
            label={t("fields.password")}
            value={password}
            onChange={setPassword}
            visible={showPassword}
            onToggle={() => setShowPassword((v) => !v)}
            placeholder={t("fields.passwordPlaceholder")}
            showLabel={t("toggle.show")}
            hideLabel={t("toggle.hide")}
          />

          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            {t("fields.remember")}
          </label>

          {authError ? (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
            >
              <div className="font-medium">{t("error.title")}</div>
              <div className="mt-1 break-words font-mono text-xs opacity-80">{authError}</div>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isAuthenticating}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAuthenticating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("connecting")}
              </>
            ) : (
              t("connect")
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">{t("hint")}</p>
      </div>
    </div>
  );
}

interface SecretFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  placeholder: string;
  showLabel: string;
  hideLabel: string;
}

function SecretField({
  label,
  value,
  onChange,
  visible,
  onToggle,
  placeholder,
  showLabel,
  hideLabel,
}: SecretFieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </span>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-10 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? hideLabel : showLabel}
          title={visible ? hideLabel : showLabel}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );
}
