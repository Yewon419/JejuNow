"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tapLight } from "@/lib/haptics";

const TABS = [
  {
    href: "/dashboard",
    label: "홈",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 12 11.2 3.05a1.125 1.125 0 0 1 1.6 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"
      />
    ),
  },
  {
    href: "/map",
    label: "지도",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z"
      />
    ),
  },
  {
    href: "/schedule",
    label: "일정",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
      />
    ),
  },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="주요 메뉴" className="fixed inset-x-0 bottom-0 z-40">
      {/*
        네이티브 UITabBar와 같은 구조: 바는 화면 바닥(bottom-0)에 붙은 채 높이만 커지고,
        홈 인디케이터 영역은 배경으로 덮는다. 인셋을 바깥 래퍼의 padding으로 주면
        배경을 가진 이 요소가 통째로 밀려 올라가 아래에 빈 공간이 생긴다.
        폰 프레임(max-w-md)에 맞춰 바 배경도 프레임 폭만 차지한다.
      */}
      <div
        className="mx-auto flex max-w-md border-t border-line bg-surface sm:border-x"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              onClick={() => {
                if (!active) tapLight(); // 같은 탭 재탭은 진동 안 함
              }}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs transition-colors ${
                active ? "text-primary" : "text-dim hover:text-ink"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={active ? 2 : 1.5}
                className="h-6 w-6"
                aria-hidden
              >
                {tab.icon}
              </svg>
              <span className={active ? "font-semibold" : ""}>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
