[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [Guid]$JobId,

  [string]$SupabaseUrl = $env:SUPABASE_URL,
  [string]$SecretKey = $env:SUPABASE_COMPLETION_SHADOW_SECRET,

  [ValidateRange(1, 50)]
  [int]$PageLimit = 20,

  [ValidateRange(1, 1000)]
  [int]$MaxPages = 100,

  [switch]$IncludeAssessments,
  [string]$OutputPath
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($SupabaseUrl)) {
  throw 'SUPABASE_URL is required.'
}

if ([string]::IsNullOrWhiteSpace($SecretKey)) {
  throw 'SUPABASE_COMPLETION_SHADOW_SECRET is required.'
}

if (-not $SecretKey.StartsWith('sb_secret_')) {
  throw 'Only a modern sb_secret_ key is accepted; legacy service_role JWT keys are intentionally rejected.'
}

$uri = "$($SupabaseUrl.TrimEnd('/'))/functions/v1/completion-contract-shadow"
$headers = @{
  apikey = $SecretKey
}
$body = @{
  job_id = $JobId.ToString()
  page_limit = $PageLimit
  max_pages = $MaxPages
  include_assessments = [bool]$IncludeAssessments
} | ConvertTo-Json -Compress

$response = Invoke-RestMethod `
  -Method Post `
  -Uri $uri `
  -Headers $headers `
  -ContentType 'application/json' `
  -Body $body

$json = $response | ConvertTo-Json -Depth 100
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $json
  return
}

$resolvedOutputPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)
$parent = Split-Path -Parent $resolvedOutputPath
if (-not [string]::IsNullOrWhiteSpace($parent) -and -not (Test-Path -LiteralPath $parent)) {
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
}
[System.IO.File]::WriteAllText($resolvedOutputPath, $json, [System.Text.UTF8Encoding]::new($false))
Write-Host "Shadow report saved to $resolvedOutputPath"
