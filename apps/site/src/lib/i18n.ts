// 构建期 i18n：中文键即中文文案；英文映射在 messages.ts（编译期键覆盖不变）。
import { english } from "../messages";

export type Lang = "zh" | "en";
export type Locale = "zh-CN" | "en";

export const LOCALES: Record<Lang, Locale> = { zh: "zh-CN", en: "en" };

export function t(lang: Lang, key: string): string {
  if (lang === "en") return english[key as keyof typeof english] ?? key;
  return key;
}

/** 同一页面的另一语言路径；英文在根路径，中文在 /zh/*。 */
export function pathFor(lang: Lang, path: string): string {
  // trailingSlash: never —— 一律不带尾斜杠（/zh、/zh/features）
  if (lang === "zh") return path === "/" ? "/zh" : `/zh${path}`;
  return path;
}

export function other(lang: Lang): Lang {
  return lang === "zh" ? "en" : "zh";
}
