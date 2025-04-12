// Translations object for multilingual support
const translations = {
  ko: {
    // Korean
    price: "가격",
    change: "변동",
    lastUpdated: "마지막 업데이트",
  },
  en: {
    // English
    price: "Price",
    change: "Change",
    lastUpdated: "Last Updated",
  },
  ja: {
    // Japanese
    price: "価格",
    change: "変動",
    lastUpdated: "最終更新",
  },
  zh: {
    // Chinese (Simplified)
    price: "价格",
    change: "变动",
    lastUpdated: "最后更新",
  },
  // Add more languages as needed
};

// Default language if user's language is not supported
const defaultLanguage = "en";

export { translations, defaultLanguage };
