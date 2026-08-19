"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteAccount, signOut } from "@/lib/authClient";
import { resetAllCoach } from "@/lib/coach";
import { tapLight, tapMedium } from "@/lib/haptics";

// 탈퇴 시 앱 데이터(일정·유형·코치마크)도 함께 제거 — 전부 jejunow: 접두 키.
function clearLocalAppData() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key !== null && key.startsWith("jejunow:")) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // 저장 불가 환경 — 계정 삭제 자체는 이미 완료된 상태라 진행
  }
}

export function SettingsActions() {
  const router = useRouter();
  const [coachReset, setCoachReset] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  async function handleSignOut() {
    tapLight();
    setSigningOut(true);
    try {
      await signOut();
      // 세션 소멸 → AuthGate가 로그인 화면으로 전환
    } catch {
      setSigningOut(false);
    }
  }

  async function handleDeleteAccount() {
    tapMedium();
    setDeleteError(false);
    setDeleting(true);
    try {
      await deleteAccount();
      clearLocalAppData();
      // 세션 소멸 → AuthGate가 로그인 화면으로 전환
    } catch {
      setDeleting(false);
      setDeleteError(true);
    }
  }

  function replayTutorial() {
    tapLight();
    resetAllCoach();
    setCoachReset(true);
  }

  function rechooseType() {
    try {
      localStorage.removeItem("jejunow:travelerType");
    } catch {
      // 저장 불가 환경 — 그래도 온보딩으로 보낸다
    }
    router.push("/");
  }

  return (
    <section className="space-y-3" aria-label="앱 설정">
      <button
        type="button"
        onClick={replayTutorial}
        className="w-full cursor-pointer rounded-card bg-card p-4 text-left shadow-card transition-transform active:scale-[0.99]"
      >
        <span className="block font-semibold text-ink">앱 사용법 다시 보기</span>
        <span className="mt-0.5 block text-sm text-dim">
          {coachReset
            ? "초기화했어요. 각 화면에 들어가면 안내가 다시 나옵니다."
            : "홈·지도·일정·상세 화면의 안내를 처음부터 다시 봅니다."}
        </span>
      </button>

      <button
        type="button"
        onClick={rechooseType}
        className="w-full cursor-pointer rounded-card bg-card p-4 text-left shadow-card transition-transform active:scale-[0.99]"
      >
        <span className="block font-semibold text-ink">여행자 유형 다시 고르기</span>
        <span className="mt-0.5 block text-sm text-dim">
          즉흥 여행자와 계획 여행자 중 다시 선택합니다.
        </span>
      </button>

      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        aria-busy={signingOut}
        className="w-full cursor-pointer rounded-card bg-card p-4 text-left shadow-card transition-transform active:scale-[0.99] disabled:opacity-60"
      >
        <span className="block font-semibold text-ink">로그아웃</span>
        <span className="mt-0.5 block text-sm text-dim">
          {signingOut ? "로그아웃 중…" : "현재 계정에서 로그아웃합니다."}
        </span>
      </button>

      {!confirmingDelete ? (
        <button
          type="button"
          onClick={() => {
            tapLight();
            setConfirmingDelete(true);
          }}
          className="w-full cursor-pointer rounded-card bg-card p-4 text-left shadow-card transition-transform active:scale-[0.99]"
        >
          <span className="block font-semibold text-lv4">계정 삭제</span>
          <span className="mt-0.5 block text-sm text-dim">
            계정과 이 기기의 일정·설정을 모두 삭제합니다.
          </span>
        </button>
      ) : (
        <div className="rounded-card bg-card p-4 shadow-card">
          <p className="font-semibold text-ink">정말 계정을 삭제할까요?</p>
          <p className="mt-0.5 text-sm text-dim">
            계정 정보와 이 기기에 저장된 일정·설정이 삭제되며 되돌릴 수 없습니다.
          </p>
          {deleteError && (
            <p className="mt-2 text-sm text-lv4" role="alert">
              삭제하지 못했어요. 잠시 후 다시 시도해 주세요.
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                tapLight();
                setConfirmingDelete(false);
                setDeleteError(false);
              }}
              disabled={deleting}
              className="flex-1 cursor-pointer rounded-card bg-bg p-3 text-center font-semibold text-ink transition-transform active:scale-[0.99] disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={deleting}
              aria-busy={deleting}
              className="flex-1 cursor-pointer rounded-card bg-lv4 p-3 text-center font-semibold text-white transition-transform active:scale-[0.99] disabled:opacity-60"
            >
              {deleting ? "삭제 중…" : "삭제"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
