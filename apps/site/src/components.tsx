import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import logoGlyph from "./assets/logo-glyph.png";
import logoGlyphDark from "./assets/logo-glyph-dark.png";
import { usePreferences } from "./preferences";

/** 官网 Logo：用户确认的 B1 弧路，与应用及托盘共享矢量母版。 */
export function Logo({ size = 24 }: { size?: number }) {
  const { resolvedTheme } = usePreferences();
  return (
    <img
      src={resolvedTheme === "dark" ? logoGlyphDark : logoGlyph}
      alt=""
      width={size}
      height={size}
      style={{ flex: "none", display: "block" }}
    />
  );
}

export function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export function DownloadIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M12 3v12M6 9l6 6 6-6M4 21h16" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

/** 章节锚点链接（#349）：HashRouter 下携带 /route#id 的可分享链接；
 *  目标与当前地址完全相同时阻止默认导航并强制重新滚动。 */
export function AnchorLink({
  to,
  className,
  children,
}: {
  to: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { pathname, hash } = useLocation();
  const hashStart = to.indexOf("#");
  const same =
    pathname === to.slice(0, hashStart) && hash === to.slice(hashStart);
  return (
    <Link
      to={to}
      className={className}
      aria-current={same ? "location" : undefined}
      onClick={(event) => {
        if (!same) return; // 路由切换后由 App 的 hash 效果负责滚动
        event.preventDefault();
        document
          .getElementById(to.slice(hashStart + 1))
          ?.scrollIntoView({ block: "start", behavior: "smooth" });
      }}
    >
      {children}
    </Link>
  );
}

/** 章节标题旁的复制链接按钮（#349）：复制 /route#id 形式的完整分享地址。 */
export function CopyLinkButton({ to }: { to: string }) {
  const { t } = usePreferences();
  const [copied, setCopied] = useState(false);
  const write = () => {
    const share = `${location.origin}${location.pathname}#${to}`;
    navigator.clipboard?.writeText(share).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  };
  return (
    <button
      className="anchor-button"
      onClick={write}
      title={t(copied ? "已复制链接" : "复制章节链接")}
      aria-label={t(copied ? "已复制链接" : "复制章节链接")}
    >
      {copied ? "✓" : <LinkIcon />}
    </button>
  );
}

