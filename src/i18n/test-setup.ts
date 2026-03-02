import i18n from "i18next";
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

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
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
    lng: "zh",
    fallbackLng: "zh",
    defaultNS: "common",
    ns: ["common", "layout", "office", "panels", "chat", "console"],
    interpolation: { escapeValue: false },
  });
}

export default i18n;
