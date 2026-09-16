[CmdletBinding()]
param(
  [ValidateRange(1, 25)]
  [int]$BatchSize = 25,

  [ValidateRange(0, 1000000)]
  [int]$StartOffset = 0,

  [ValidateRange(0, 60000)]
  [int]$DelayMilliseconds = 250,

  [string]$SupabaseUrl = 'https://kevpkawrbtovrgyjkkvu.supabase.co',
  [string]$SecretKey = $env:SUPABASE_COMPLETION_SHADOW_SECRET,
  [string]$SecretPath = $env:SUPABASE_COMPLETION_SHADOW_SECRET_PATH,
  [string]$OutputDirectory = (
    Join-Path ([Environment]::GetFolderPath('UserProfile')) `
      ('Downloads\d10-v2-backfill-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
  )
)

$ErrorActionPreference = 'Stop'

function Get-D10Secret {
  if (-not [string]::IsNullOrWhiteSpace($SecretKey)) {
    return [regex]::Replace($SecretKey, '\s', '')
  }
  $path = $SecretPath
  if ([string]::IsNullOrWhiteSpace($path)) {
    $path = Join-Path $env:LOCALAPPDATA `
      'NorskTrainer\secrets\completion-shadow.dpapi'
  }
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Encrypted internal key was not found: $path"
  }
  $encrypted = (Get-Content -LiteralPath $path -Raw).Trim()
  $secure = ConvertTo-SecureString -String $encrypted
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [regex]::Replace(
      [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer),
      '\s',
      ''
    )
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    $secure.Dispose()
  }
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$checkpointPath = Join-Path $OutputDirectory 'checkpoint.json'
$resultsPath = Join-Path $OutputDirectory 'results.ndjson'
$secret = Get-D10Secret
$headers = @{ apikey = $secret; Authorization = "Bearer $secret" }
$offset = $StartOffset
$totalProcessed = 0
$totalPersisted = 0
$totalFailed = 0

try {
  while ($true) {
    $payload = @{
      backfill = $true
      persist = $true
      offset = $offset
      limit = $BatchSize
    } | ConvertTo-Json -Compress

    $response = Invoke-RestMethod `
      -Uri "$($SupabaseUrl.TrimEnd('/'))/functions/v1/forms-enrichment-v2-worker" `
      -Method Post `
      -Headers $headers `
      -ContentType 'application/json; charset=utf-8' `
      -Body ([Text.Encoding]::UTF8.GetBytes($payload)) `
      -TimeoutSec 180

    if ($response.worker -ne 'forms-enrichment-v2-worker') {
      throw 'V2_WORKER_CONTRACT_VIOLATION'
    }

    $rows = @($response.results)
    $failedRows = @($rows | Where-Object { $_.persisted -ne $true })
    foreach ($row in $rows) {
      Add-Content `
        -LiteralPath $resultsPath `
        -Value ($row | ConvertTo-Json -Depth 12 -Compress) `
        -Encoding utf8
    }

    $persisted = @($rows | Where-Object { $_.persisted -eq $true }).Count
    $totalProcessed += $rows.Count
    $totalPersisted += $persisted
    $totalFailed += $failedRows.Count

    $checkpoint = [ordered]@{
      offset = $offset
      nextOffset = $response.nextOffset
      total = $response.total
      totalProcessed = $totalProcessed
      totalPersisted = $totalPersisted
      failed = $failedRows.Count
      updatedAt = [DateTime]::UtcNow.ToString('o')
    }
    $checkpoint | ConvertTo-Json -Depth 6 |
      Set-Content -LiteralPath $checkpointPath -Encoding utf8

    Write-Host (
      'offset={0} processed={1} persisted={2} failed={3} total={4}' -f `
        $offset, $rows.Count, $persisted, $failedRows.Count, $response.total
    )

    if ($response.hasMore -ne $true) { break }
    $offset = [int]$response.nextOffset
    if ($DelayMilliseconds -gt 0) {
      Start-Sleep -Milliseconds $DelayMilliseconds
    }
  }
}
finally {
  $secret = $null
  $headers = $null
}

Write-Host 'PASS: D10 V2-only morphology backfill completed.'
Write-Host "Processed: $totalProcessed"
Write-Host "Persisted: $totalPersisted"
Write-Host "Failed:    $totalFailed"
Write-Host "Output:    $OutputDirectory"
if ($totalFailed -gt 0) {
  throw "D10_BACKFILL_COMPLETED_WITH_$($totalFailed)_FAILURES"
}
