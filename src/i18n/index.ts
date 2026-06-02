import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import enAuth from "./locales/en/auth.json";
import enChat from "./locales/en/chat.json";
import enCommon from "./locales/en/common.json";
import enConsole from "./locales/en/console.json";
import enLayout from "./locales/en/layout.json";
import enOffice from "./locales/en/office.json";
import enPanels from "./locales/en/panels.json";
import zhChat from "./locales/zh/chat.json";
import zhCommon from "./locales/zh/common.json";
import zhConsole from "./locales/zh/console.json";
import zhLayout from "./locales/zh/layout.json";
import zhOffice from "./locales/zh/office.json";
import zhPanels from "./locales/zh/panels.json";
import zhAuth from "./locales/zh/auth.json";

export const supportedLngs = ["zh", "en"] as const;
export type SupportedLng = (typeof supportedLngs)[number];

export const namespaces = ["common", "layout", "office", "panels", "chat", "console", "auth"] as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      zh: {
        common: zhCommon,
        layout: zhLayout,
        office: zhOffice,
        panels: zhPanels,
        chat: zhChat,
        console: zhConsole,
        auth: zhAuth,
      },
      en: {
        common: enCommon,
        layout: enLayout,
        office: enOffice,
        panels: enPanels,
        chat: enChat,
        console: enConsole,
        auth: enAuth,
      },
    },
    supportedLngs: [...supportedLngs],
    fallbackLng: "zh",
    defaultNS: "common",
    ns: [...namespaces],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "i18nextLng",
    },
  });

export default i18n;
