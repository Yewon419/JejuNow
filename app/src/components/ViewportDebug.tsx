"use client";

import { useEffect, useState } from "react";

/** 실기기 레이아웃 진단용 임시 표시 — 설정 하단에 뷰포트·배율·프레임 폭을 보여준다.
 *  아이패드 가로 넘침이 데스크톱·프로파일 WebKit에서 재현되지 않아 실기기 값이 필요.
 *  원인 확정 후 제거 예정. */
export function ViewportDebug() {
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    function measure() {
      const doc = document.documentElement;
      const frame = document.querySelector("body > div");
      const scale = window.visualViewport ? window.visualViewport.scale : 0;
      setInfo(
        `vp ${window.innerWidth}×${window.innerHeight} · dpr ${window.devicePixelRatio}` +
          ` · scale ${scale.toFixed(2)} · doc ${doc.scrollWidth}/${doc.clientWidth}` +
          ` · frame ${frame ? Math.round(frame.getBoundingClientRect().width) : "?"}`,
      );
    }
    measure();
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, []);

  if (info === null) return null;
  return <p className="mt-2 text-center text-[10px] text-dim/60">{info}</p>;
}
