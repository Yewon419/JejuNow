# JejuNow 웹데모 Vercel 배포 (선행: npx vercel login — 1회, 사람)
# 동작: 중앙 .env의 공개(NEXT_PUBLIC) env를 Vercel CLI로 재등록·검증 후 프로덕션 배포.
# ⚠️ REST API(Bearer 토큰) 방식 금지 — CLI 48+는 auth.json의 정적 토큰이 만료 상태
#    (refreshToken으로 CLI 내부에서만 갱신)라 invalidToken으로 죽는다 (2026-07-11 검증).
# ⚠️ env 값을 PowerShell 파이프로 넘기지 않는다 (`값 | vercel env add`가 값 오염,
#    40자→1104자 — 2026-06-13 검증). 임시 ASCII 파일 + cmd stdin 리다이렉트로 넘기고,
#    env pull로 값 무결성을 반드시 검증한다.
# 참고: Deployment Protection 해제·Node 22 고정은 이 프로젝트에 1회 적용 완료(2026-06-13).
#    새 Vercel 프로젝트를 만들 경우 대시보드에서 수동 재적용 필요.
# 사용: powershell -ExecutionPolicy Bypass -File scripts\deploy_vercel.ps1

$ErrorActionPreference = "Stop"
$envFile = "C:\Users\windg\Desktop\PROJECT\_keys\JejuNow\.env"
$appDir = Join-Path $PSScriptRoot "..\app"
$projectFile = Join-Path $appDir ".vercel\project.json"

# 0) 프로젝트 링크 (최초 1회)
Set-Location $appDir
if (-not (Test-Path $projectFile)) {
    npx vercel link --yes --project jejunow
}

# 1) 로그인 확인 (CLI가 refreshToken으로 알아서 인증 — 토큰 파일 직접 읽기 금지)
npx vercel whoami | Out-Null
if ($LASTEXITCODE -ne 0) { throw "vercel 로그인 필요: npx vercel login" }

# 2) .env에서 공개 키 파싱
$vars = @{}
Get-Content $envFile -Encoding UTF8 | ForEach-Object {
    if ($_ -match '^([A-Z_]+)=(.+)$') { $vars[$Matches[1]] = $Matches[2].Trim() }
}
$map = [ordered]@{
    "NEXT_PUBLIC_SUPABASE_URL"      = $vars["SUPABASE_URL"]
    "NEXT_PUBLIC_SUPABASE_ANON_KEY" = $vars["SUPABASE_ANON_KEY"]
    "NEXT_PUBLIC_KAKAO_JS_KEY"      = $vars["KAKAO_JS_KEY"]
    # 서버 전용(NEXT_PUBLIC 아님) — /api/kakao-route 카카오내비 프록시용
    "KAKAO_REST_API_KEY"            = $vars["KAKAO_REST_API_KEY"]
}
# 라이브 추론 API (Render 배포 후 .env에 RENDER_API_URL 추가하면 자동 등록 — 없으면 프론트가 폴백)
if ($vars["RENDER_API_URL"]) { $map["NEXT_PUBLIC_API_URL"] = $vars["RENDER_API_URL"] }

# 3) CLI로 재등록 (remove는 없으면 실패해도 무시, add는 파일 stdin으로)
$targets = @("production", "preview")
$tmp = Join-Path $env:TEMP "vercel_env_value.txt"
foreach ($name in $map.Keys) {
    if (-not $map[$name]) { throw "$name 값이 비어 있음 — $envFile 확인" }
    if ($map[$name] -match '[^\x20-\x7e]') { throw "$name 값에 비ASCII 문자 — stdin 전달 안전성 보장 불가" }
    Set-Content -Path $tmp -Value $map[$name] -NoNewline -Encoding Ascii
    foreach ($t in $targets) {
        cmd /c "npx vercel env remove $name $t --yes 2>nul" | Out-Null
        cmd /c "npx vercel env add $name $t < `"$tmp`""
        if ($LASTEXITCODE -ne 0) { throw "env add 실패: $name ($t)" }
    }
    Write-Output ("env set {0} (len={1})" -f $name, $map[$name].Length)
}
Remove-Item $tmp -Force

# 4) 값 무결성 검증 (production 기준 — 오염 시 여기서 멈춘다)
$pullFile = Join-Path $env:TEMP "vercel_env_pull.env"
cmd /c "npx vercel env pull `"$pullFile`" --environment production --yes" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "env pull 실패 — 검증 불가" }
$pulled = @{}
Get-Content $pullFile -Encoding UTF8 | ForEach-Object {
    if ($_ -match '^([A-Z_]+)="?([^"]*)"?$') { $pulled[$Matches[1]] = $Matches[2] }
}
foreach ($name in $map.Keys) {
    if ($pulled[$name] -ne $map[$name]) {
        throw "env 값 불일치: $name (pull=$(($pulled[$name]).Length)자, 기대=$($map[$name].Length)자)"
    }
}
Remove-Item $pullFile -Force
Write-Output "env 검증 통과 (production)"

# 5) NEXT_PUBLIC은 빌드타임 인라인 → 프로덕션 재배포
# cmd /c 경유 필수: powershell -File + 출력 캡처 환경에서 vercel CLI의 stderr 스트림이
# 유실되며 배포가 실행되지 않는 PS 5.1 동작 확인 (2026-07-11). env 단계와 동일 우회.
cmd /c "npx vercel deploy --prod --yes"
if ($LASTEXITCODE -ne 0) { throw "deploy 실패" }
Write-Output "deploy 완료 — https://jejunow.vercel.app"
