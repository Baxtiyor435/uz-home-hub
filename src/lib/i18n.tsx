/** Lightweight UZ/RU internationalisation for the app shell and catalogue. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "uz" | "ru";

const STORAGE_KEY = "ubu-lang";

const DICT = {
  "nav.sale": { uz: "Sotuv", ru: "Продажа" },
  "nav.rent": { uz: "Ijara", ru: "Аренда" },
  "nav.agents": { uz: "Agentlar", ru: "Агенты" },
  "nav.home": { uz: "Bosh sahifa", ru: "Главная" },
  "nav.favorites": { uz: "Sevimlilar", ru: "Избранное" },
  "nav.profile": { uz: "Profil", ru: "Профиль" },
  "nav.sections": { uz: "Bo'limlar", ru: "Разделы" },
  "nav.main": { uz: "Asosiy menyu", ru: "Главное меню" },

  "header.notifications": { uz: "Bildirishnomalar", ru: "Уведомления" },
  "header.create": { uz: "E'lon joylash", ru: "Разместить" },
  "header.account": { uz: "Hisobim", ru: "Мой аккаунт" },
  "header.user": { uz: "Foydalanuvchi", ru: "Пользователь" },
  "header.myProfile": { uz: "Profilim", ru: "Мой профиль" },
  "header.myListings": { uz: "Mening e'lonlarim", ru: "Мои объявления" },
  "header.chats": { uz: "Suhbatlar", ru: "Сообщения" },
  "header.admin": { uz: "Admin panel", ru: "Админ панель" },
  "header.signOut": { uz: "Chiqish", ru: "Выйти" },
  "header.signIn": { uz: "Kirish", ru: "Войти" },
  "header.language": { uz: "Til", ru: "Язык" },

  "list.search": { uz: "Qidiruv: sarlavha yoki tuman", ru: "Поиск: заголовок или район" },
  "list.searchLabel": { uz: "Qidiruv", ru: "Поиск" },
  "list.region": { uz: "Hudud", ru: "Регион" },
  "list.allRegions": { uz: "Barcha hududlar", ru: "Все регионы" },
  "list.kind": { uz: "Turi", ru: "Тип" },
  "list.allKinds": { uz: "Barcha turlari", ru: "Все типы" },
  "list.sort": { uz: "Saralash", ru: "Сортировка" },
  "list.sortNew": { uz: "Avval yangilari", ru: "Сначала новые" },
  "list.sortAsc": { uz: "Narx: arzondan", ru: "Цена: по возрастанию" },
  "list.sortDesc": { uz: "Narx: qimmatdan", ru: "Цена: по убыванию" },
  "list.errorTitle": { uz: "E'lonlarni yuklab bo'lmadi", ru: "Не удалось загрузить объявления" },
  "list.errorText": {
    uz: "Internet aloqasini tekshirib, sahifani yangilang.",
    ru: "Проверьте соединение и обновите страницу.",
  },
  "list.emptyTitle": { uz: "E'lonlar topilmadi", ru: "Объявления не найдены" },
  "list.emptyText": {
    uz: "Filtrlarni o'zgartirib ko'ring yoki keyinroq qayta tekshiring.",
    ru: "Измените фильтры или загляните позже.",
  },

  "card.perMonth": { uz: " / oyiga", ru: " / в месяц" },
  "card.rooms": { uz: "xona", ru: "комн." },
  "card.top": { uz: "TOP", ru: "ТОП" },

  "my.title": { uz: "Mening e'lonlarim", ru: "Мои объявления" },
  "my.new": { uz: "Yangi e'lon", ru: "Новое объявление" },
  "my.views": { uz: "ko'rish", ru: "просмотров" },
  "my.open": { uz: "E'lonni ochish", ru: "Открыть объявление" },

  "top.button": { uz: "TOP ga chiqarish", ru: "Поднять в ТОП" },
  "top.active": { uz: "TOP da", ru: "В ТОПе" },
  "top.title": { uz: "E'lonni TOP ga chiqarish", ru: "Поднять объявление в ТОП" },
  "top.desc": {
    uz: "TOP e'lonlar ro'yxatning eng yuqorisida va maxsus belgi bilan ko'rsatiladi.",
    ru: "ТОП-объявления показываются в самом верху списка со специальным значком.",
  },
  "top.days": { uz: "kun", ru: "дней" },
  "top.pay": { uz: "To'lash va TOP ga chiqarish", ru: "Оплатить и поднять" },
  "top.success": { uz: "E'lon TOP ga chiqarildi", ru: "Объявление поднято в ТОП" },
  "top.error": { uz: "TOP ga chiqarib bo'lmadi", ru: "Не удалось поднять в ТОП" },
  "top.until": { uz: "gacha TOP da", ru: "в ТОПе до" },

  "promote.opening": { uz: "Payme to'lov sahifasi ochilmoqda...", ru: "Открывается страница оплаты Payme..." },
  "promote.payWithPayme": { uz: "Payme orqali to'lash", ru: "Оплатить через Payme" },
} as const;

export type TranslationKey = keyof typeof DICT;

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
};

const LanguageContext = createContext<LanguageContextValue>({
  lang: "uz",
  setLang: () => {},
  t: (key) => DICT[key].uz,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("uz");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "ru" || stored === "uz") setLangState(stored);
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
  }, []);

  const t = useCallback((key: TranslationKey) => DICT[key][lang] ?? DICT[key].uz, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  return useContext(LanguageContext);
}

/** Inline bilingual helper: tr("O'zbek matn", "Русский текст") picks by current lang. */
export function useTr() {
  const { lang } = useLang();
  return useCallback((uz: string, ru: string) => (lang === "ru" ? ru : uz), [lang]);
}

/** Translates a deal type / property kind label pair without a provider lookup table. */
export const DEAL_TYPE_I18N: Record<"sale" | "rent", Record<Lang, string>> = {
  sale: { uz: "Sotuv", ru: "Продажа" },
  rent: { uz: "Ijara", ru: "Аренда" },
};

export const PROPERTY_KIND_I18N: Record<string, Record<Lang, string>> = {
  apartment: { uz: "Kvartira", ru: "Квартира" },
  house: { uz: "Uy / Hovli", ru: "Дом / Участок" },
  commercial: { uz: "Tijorat obyekti", ru: "Коммерция" },
  land: { uz: "Yer uchastkasi", ru: "Земельный участок" },
};
