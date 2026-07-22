import { BottomNav } from "@/components/BottomNav";
import { SwipeNav } from "@/components/SwipeNav";

export default function TabsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="mx-auto min-h-dvh max-w-xl pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
      <SwipeNav>{children}</SwipeNav>
      <BottomNav />
    </div>
  );
}
