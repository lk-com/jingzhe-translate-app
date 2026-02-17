"use client";

import { useEffect, useState } from 'react';

/**
 * HtmlProvider - 处理浏览器扩展导致的水合不匹配问题
 *
 * 某些浏览器扩展（如阿里系通义千问）会在服务端渲染的 HTML 上
 * 注入额外的属性，导致 React 水合不匹配警告。
 *
 * 这个组件通过在客户端同步扩展注入的属性来解决这个问题。
 */
export function HtmlProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // 强制同步浏览器扩展注入的属性，避免水合不匹配
    const html = document.documentElement;
    if (html.getAttribute('suppressHydrationWarning') === null) {
      html.setAttribute('suppressHydrationWarning', 'true');
    }
  }, []);

  // 在 hydration 完成前不渲染任何内容，避免水合不匹配
  if (!mounted) {
    return <>{children}</>;
  }

  return <>{children}</>;
}
