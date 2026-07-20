import { BottomNav } from "@/components/BottomNav";

export default function TabsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="mx-auto min-h-dvh max-w-xl pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
      {children}
      <BottomNav />
    </div>
  );
}
