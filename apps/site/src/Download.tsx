import { usePreferences } from "./preferences";
import { Link } from "react-router-dom";
import { DownloadIcon } from "./components";
import { useLatestRelease } from "./hooks/useLatestRelease";
import { LATEST, RELEASES } from "./site-meta";

/** 按访问系统推荐下载项（#349）；其余平台仍完整列出。 */
function detectedPlatform(): "macOS" | "Windows" | "Linux" | null {
  const ua = navigator.userAgent;
  if (/Mac/i.test(ua)) return "macOS";
  if (/Win/i.test(ua)) return "Windows";
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) return "Linux";
  return null;
}

export default function Download({ standalone = false }: { standalone?: boolean }) {
  const { t } = usePreferences();
  const Heading = standalone ? "h1" : "h2";
  const { release, status, stale, retry } = useLatestRelease();
  const recommended = detectedPlatform();
  const platforms = [
    { name: "macOS", detail: t("Apple Silicon · M 系列芯片"), url: release?.dmgUrl, label: t("下载 DMG"), note: t("Developer ID 签名与公证；拖入应用程序后启动。") },
    { name: "Windows", detail: "x64 · Windows 11", url: release?.windowsUrl, label: t("下载 EXE"), note: t("尚无 Windows 代码签名；请核对官方来源及发布页中的 SHA256SUMS。") },
    { name: "Linux", detail: t("x86_64 · 社区实验版"), url: release?.linuxUrl, label: t("下载 TAR.GZ"), note: t("已在 CachyOS / niri 环境验证部分功能。解压后以普通用户运行；代理需手动配置，TUN 需另装服务。") },
  ];
  const headline =
    release
      ? `${release.version}${release.date ? ` · ${release.date}` : ""} · ${t("macOS / Windows 支持应用内更新；Linux 实验版手动下载")}`
      : status === "loading"
        ? t("正在获取最新版本…")
        : t("版本信息获取失败");
  return <section id="download" className="shell content-section download-section">
    <div className="section-heading"><Heading>{t("下载 Crossbow")}</Heading><p>{headline}</p></div>
    {(status === "failed" || stale) && (
      <p className="download-notice" role="status">
        {status === "failed" ? t("版本信息获取失败，可重试或直接前往发布页。") : t("当前展示的是缓存的版本信息（本次刷新失败）。")}
        <button className="download-retry" onClick={retry}>{t("重试")}</button>
      </p>
    )}
    <div className="download-platforms">{platforms.map(p => <article key={p.name} className={"download-platform" + (recommended === p.name ? " recommended" : "")}><span className="platform-detail">{p.detail}</span>{recommended === p.name && <span className="platform-badge">{t("检测到你的系统")}</span>}<h3>Crossbow for {p.name}</h3><p>{p.note}</p><div className="platform-actions">{status === "loading" ? <span className="download-state" role="status">{t("正在获取最新版本…")}</span> : p.url ? <a className="primary-button" href={p.url} target="_blank" rel="noopener noreferrer"><DownloadIcon />{p.label}</a> : <a className="primary-button" href={LATEST} target="_blank" rel="noopener noreferrer"><DownloadIcon />{t(status === "failed" ? "前往发布页下载" : "该版本暂无此安装包，前往发布页")}</a>}{p.name === "Linux" && <Link className="text-link platform-guide" to="/guide#linux">{t("Linux 安装与支持范围 →")}</Link>}</div></article>)}</div>
    <div className="download-links"><a href={LATEST} target="_blank" rel="noopener noreferrer">{t("更新说明 ↗")}</a>{release?.checksumsUrl && <a href={release.checksumsUrl} target="_blank" rel="noopener noreferrer">SHA256SUMS ↗</a>}<a href={RELEASES} target="_blank" rel="noopener noreferrer">{t("历史版本 ↗")}</a><Link className="text-link" to="/features#support-matrix">{t("平台支持矩阵 ↗")}</Link></div>
    <p className="download-note">{t("iOS 正在真机开发验证中，暂未公开分发。安装或连接遇到问题，可先查看")}<Link to="/guide">{t("进阶指南")}</Link>{t("。")}</p>
  </section>;
}
