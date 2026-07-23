import { BottomNav } from "@/components/BottomNav";
import { SwipeNav } from "@/components/SwipeNav";

export default function TabsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 폭은 루트 레이아웃 프레임이 결정한다 — 여기서 다시 조이면(과거 max-w-xl)
  // 아이패드에서 프레임 확장이 무효가 된다
  return (
    <div className="min-h-dvh pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
      <SwipeNav>{children}</SwipeNav>
      <BottomNav />
    </div>
  );
}
