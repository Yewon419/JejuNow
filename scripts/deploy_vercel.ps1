# JejuNow 웹데모 Vercel 배포 (선행: npx vercel login — 1회, 사람)
# 동작: 중앙 .env의 공개(NEXT_PUBLIC) 3종을 Vercel API로 등록 후 프로덕션 배포.
# ⚠️ env 등록은 반드시 API로 (`| npx vercel env add` 파이프는 값을 오염시킴 — 2026-06-13 검증).
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
$proj = (Get-Content $projectFile -Raw | ConvertFrom-Json)
$projectId = $proj.projectId
$teamId = $proj.orgId

# 1) CLI 토큰 로드
$authPath = "$env:APPDATA\com.vercel.cli\Data\auth.json"
if (-not (Test-Path $authPath)) { throw "vercel 로그인 필요: npx vercel login" }
$token = (Get-Content $authPath -Raw | ConvertFrom-Json).token
$headers = @{ Authorization = "Bearer $token" }

# 2) .env에서 공개 키 파싱
$vars = @{}
Get-Content $envFile -Encoding UTF8 | ForEach-Object {
    if ($_ -match '^([A-Z_]+)=(.+)$') { $vars[$Matches[1]] = $Matches[2].Trim() }
}
$map = [ordered]@{
    "NEXT_PUBLIC_SUPABASE_URL"      = $vars["SUPABASE_URL"]
    "NEXT_PUBLIC_SUPABASE_ANON_KEY" = $vars["SUPABASE_ANON_KEY"]
    "NEXT_PUBLIC_KAKAO_JS_KEY"      = $vars["KAKAO_JS_KEY"]
}
# 라이브 추론 API (Render 배포 후 .env에 RENDER_API_URL 추가하면 자동 등록 — 없으면 프론트가 폴백)
if ($vars["RENDER_API_URL"]) { $map["NEXT_PUBLIC_API_URL"] = $vars["RENDER_API_URL"] }

# 3) 기존 NEXT_PUBLIC env 삭제 후 API로 재등록 (파이프 금지)
$existing = Invoke-RestMethod -Uri "https://api.vercel.com/v9/projects/$projectId/env?teamId=$teamId" -Headers $headers
foreach ($e in ($existing.envs | Where-Object { $_.key -like "NEXT_PUBLIC*" })) {
    Invoke-RestMethod -Method Delete -Uri "https://api.vercel.com/v9/projects/$projectId/env/$($e.id)?teamId=$teamId" -Headers $headers | Out-Null
}
foreach ($name in $map.Keys) {
    if (-not $map[$name]) { throw "$name 값이 비어 있음 — $envFile 확인" }
    $payload = @{ key = $name; value = $map[$name]; type = "plain"; target = @("production", "preview") } | ConvertTo-Json -Compress
    Invoke-RestMethod -Method Post -Uri "https://api.vercel.com/v10/projects/$projectId/env?teamId=$teamId" -Headers $headers -ContentType "application/json" -Body $payload | Out-Null
    Write-Output ("env set {0} (len={1})" -f $name, $map[$name].Length)
}

# 4) 공개 데모이므로 Deployment Protection 해제 + Node 22 고정(로컬 검증 버전)
Invoke-RestMethod -Method Patch -Uri "https://api.vercel.com/v9/projects/$projectId`?teamId=$teamId" -Headers $headers -ContentType "application/json" -Body '{"ssoProtection":null,"nodeVersion":"22.x"}' | Out-Null

# 5) NEXT_PUBLIC은 빌드타임 인라인 → 프로덕션 재배포
npx vercel deploy --prod --yes
