import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
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
import ruChat from "./locales/ru/chat.json";
import ruCommon from "./locales/ru/common.json";
import ruConsole from "./locales/ru/console.json";
import ruLayout from "./locales/ru/layout.json";
import ruOffice from "./locales/ru/office.json";
import ruPanels from "./locales/ru/panels.json";

export const supportedLngs = ["ru", "zh", "en"] as const;
export type SupportedLng = (typeof supportedLngs)[number];

export const namespaces = ["common", "layout", "office", "panels", "chat", "console"] as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ru: {
        common: ruCommon,
        layout: ruLayout,
        office: ruOffice,
        panels: ruPanels,
        chat: ruChat,
        console: ruConsole,
      },
      zh: {
        common: zhCommon,
        layout: zhLayout,
        office: zhOffice,
        panels: zhPanels,
        chat: zhChat,
        console: zhConsole,
      },
      en: {
        common: enCommon,
        layout: enLayout,
        office: enOffice,
        panels: enPanels,
        chat: enChat,
        console: enConsole,
      },
    },
    supportedLngs: [...supportedLngs],
    fallbackLng: "ru",
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
