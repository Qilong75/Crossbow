import { useCallback, useEffect, useState } from "react";

export interface ReleaseInfo {
  /** 形如 v0.10.1 */
  version: string;
  /** Apple Silicon dmg 资产直链（该版本含此资产时才有） */
  dmgUrl: string | null;
  /** Windows x64 NSIS 安装包 */
  windowsUrl: string | null;
  /** Linux x86_64 实验版归档；缺失时回落发布页 */
  linuxUrl: string | null;
  /** 该版本发布资产的 SHA256SUMS */
  checksumsUrl: string | null;
  /** 发布日期 YYYY-MM-DD */
  date: string | null;
}

export type ReleaseStatus = "loading" | "ready" | "failed";

const API = "https://api.github.com/repos/Richard-Zhang1019/Crossbow/releases/latest";
const CACHE_KEY = "crossbow-release-cache-v1";

interface CacheShape {
  savedAt: string;
  info: ReleaseInfo;
}

function readCache(): ReleaseInfo | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheShape;
    return parsed?.info?.version ? parsed.info : null;
  } catch {
    return null;
  }
}

function writeCache(info: ReleaseInfo) {
  try {
    const payload: CacheShape = { savedAt: new Date().toISOString(), info };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // 隐身模式或存储受限：缓存不可用不影响主流程。
  }
}

function parseRelease(d: {
  tag_name?: unknown;
  assets?: Array<{ name: string; browser_download_url: string }>;
  published_at?: unknown;
}): ReleaseInfo | null {
  if (typeof d?.tag_name !== "string") return null;
  const assets = d.assets ?? [];
  const dmg = assets.find((a) => /aarch64\.dmg$/i.test(a.name));
  const windows = assets.find((a) => /_x64-setup\.exe$/i.test(a.name));
  const linux = assets.find((a) => /_linux_x86_64\.tar\.gz$/i.test(a.name));
  const checksums = assets.find((a) => a.name === "SHA256SUMS");
  return {
    version: d.tag_name,
    dmgUrl: dmg?.browser_download_url ?? null,
    windowsUrl: windows?.browser_download_url ?? null,
    linuxUrl: linux?.browser_download_url ?? null,
    checksumsUrl: checksums?.browser_download_url ?? null,
    date: typeof d.published_at === "string" ? d.published_at.slice(0, 10) : null,
  };
}

/** 运行时拉取最新 release（#349）：区分加载中 / 失败 / 就绪，失败可重试。
 *  成功结果写入 localStorage，下次访问先显示缓存（stale 标记）再后台刷新；
 *  版本号/安装包链接/发布日期自动跟随 GitHub，无需发版后手动改官网。 */
export function useLatestRelease() {
  const [release, setRelease] = useState<ReleaseInfo | null>(() => readCache());
  const [status, setStatus] = useState<ReleaseStatus>(() => (readCache() ? "ready" : "loading"));
  const [stale, setStale] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let dead = false;
    fetch(API)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (dead) return;
        const info = parseRelease(d);
        if (!info) return;
        setRelease(info);
        writeCache(info);
        setStale(false);
        setStatus("ready");
      })
      .catch(() => {
        if (dead) return;
        setStale(true);
        setStatus((s) => (s === "ready" ? "ready" : "failed"));
      });
    return () => {
      dead = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setStale(false);
    setStatus((s) => (s === "ready" ? "ready" : "loading"));
    setAttempt((a) => a + 1);
  }, []);

  return { release, status, stale, retry };
}
