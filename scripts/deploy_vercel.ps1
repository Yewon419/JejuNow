# JejuNow 웹데모 Vercel 배포 (선행: npx vercel login — 1회, 사람)
# 동작: 중앙 .env에서 공개(NEXT_PUBLIC) 3개 값을 Vercel 프로젝트 env로 등록 후 프로덕션 배포.
# 사용: powershell -ExecutionPolicy Bypass -File scripts\deploy_vercel.ps1

$ErrorActionPreference = "Stop"
$envFile = "C:\Users\windg\Desktop\PROJECT\_keys\JejuNow\.env"
$appDir = Join-Path $PSScriptRoot "..\app"

$vars = @{}
Get-Content $envFile -Encoding UTF8 | ForEach-Object {
    if ($_ -match '^([A-Z_]+)=(.+)$') { $vars[$Matches[1]] = $Matches[2].Trim() }
}
$publicMap = @{
    "NEXT_PUBLIC_SUPABASE_URL"      = $vars["SUPABASE_URL"]
    "NEXT_PUBLIC_SUPABASE_ANON_KEY" = $vars["SUPABASE_ANON_KEY"]
    "NEXT_PUBLIC_KAKAO_JS_KEY"      = $vars["KAKAO_JS_KEY"]
}

Set-Location $appDir
# 1) 최초 배포로 프로젝트 생성+링크 (env 없어서 페이지는 아직 500 — 정상)
npx vercel deploy --yes

# 2) 공개 env 3종 등록
foreach ($name in $publicMap.Keys) {
    $value = $publicMap[$name]
    if (-not $value) { throw "$name 값이 비어 있음 — $envFile 확인" }
    # 기존 값 제거 후 재등록 (없으면 rm은 실패해도 무시)
    cmd /c "npx vercel env rm $name production --yes 2>nul"
    $value | npx vercel env add $name production
}

# 3) env 반영된 프로덕션 배포
npx vercel deploy --prod --yes
