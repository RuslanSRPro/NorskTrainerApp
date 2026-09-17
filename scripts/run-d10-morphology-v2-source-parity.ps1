param(
  [ValidateRange(1, 25)] [int]$BatchSize = 25,
  [ValidateRange(0, 60000)] [int]$DelayMilliseconds = 250,
  [string]$SupabaseUrl = 'https://kevpkawrbtovrgyjkkvu.supabase.co',
  [string]$SecretKey = $env:SUPABASE_COMPLETION_SHADOW_SECRET,
  [string]$SecretPath = $env:SUPABASE_COMPLETION_SHADOW_SECRET_PATH,
  [string]$OutputDirectory = (Join-Path $env:USERPROFILE (
    'Downloads\d10-v2-source-parity-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
  ))
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$BackfillRunner = Join-Path $PSScriptRoot 'run-d10-morphology-v2-backfill.ps1'
if (-not (Test-Path -LiteralPath $BackfillRunner -PathType Leaf)) {
  throw "Verified credential runner was not found: $BackfillRunner"
}

$tokens = $null
$parseErrors = $null
$runnerAst = [Management.Automation.Language.Parser]::ParseFile(
  $BackfillRunner, [ref]$tokens, [ref]$parseErrors
)
if (@($parseErrors).Count -ne 0) { throw 'Credential runner did not parse.' }
$functions = @($runnerAst.FindAll({
  param($node)
  $node -is [Management.Automation.Language.FunctionDefinitionAst] -and
    $node.Name -eq 'Get-D10Secret'
}, $true))
if ($functions.Count -ne 1) { throw 'Expected one Get-D10Secret function.' }
Invoke-Expression $functions[0].Extent.Text
$secret = Get-D10Secret
$headers = @{ apikey = $secret; Authorization = "Bearer $secret" }

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$resultsPath = Join-Path $OutputDirectory 'results.ndjson'
$summaryPath = Join-Path $OutputDirectory 'summary.json'

try {
  $displayRows = [Collections.Generic.List[object]]::new()
  $rangeStart = 0
  $pageSize = 1000
  while ($true) {
    $pageHeaders = @{
      apikey = $secret
      Authorization = "Bearer $secret"

    }
    $uri = "$($SupabaseUrl.TrimEnd('/'))/rest/v1/lexeme_form_display_v2" +
      "?select=lexeme_id,pos&pos=in.(noun,adjective)&order=lexeme_id.asc&limit=$pageSize&offset=$rangeStart"
    $rawPage = Invoke-RestMethod -Uri $uri -Headers $pageHeaders -Method Get -UserAgent 'NorskTrainer-D10-Source-Parity/1.0' -TimeoutSec 180
    $page = [Collections.Generic.List[object]]::new()
    foreach ($row in $rawPage) {
      $page.Add($row)
      $displayRows.Add($row)
    }
    if ($page.Count -lt $pageSize) { break }
    $rangeStart += $pageSize
  }

  $ids = @($displayRows | ForEach-Object { [string]$_.lexeme_id } | Sort-Object -Unique)
  if ($ids.Count -ne 1125) {
    throw "Expected 1125 noun/adjective lexemes, found $($ids.Count)."
  }

  $counts = @{
    exact_match = 0
    policy_only_difference = 0
    source_changed = 0
    identity_unresolved = 0
  }
  $processed = 0
  for ($offset = 0; $offset -lt $ids.Count; $offset += $BatchSize) {
    $end = [Math]::Min($offset + $BatchSize, $ids.Count)
    $batch = @($ids[$offset..($end - 1)])
    $payload = @{ lexemeIds = $batch; verifyPersisted = $true; persist = $false } |
      ConvertTo-Json -Compress
    $response = Invoke-RestMethod `
      -Uri "$($SupabaseUrl.TrimEnd('/'))/functions/v1/forms-enrichment-v2-worker" `
      -Method Post -Headers $headers -UserAgent 'NorskTrainer-D10-Source-Parity/1.0' -ContentType 'application/json; charset=utf-8' `
      -Body ([Text.Encoding]::UTF8.GetBytes($payload)) -TimeoutSec 180
    if ($response.mode -ne 'verify_persisted') { throw 'Unexpected worker mode.' }
    foreach ($row in @($response.results)) {
      Add-Content -LiteralPath $resultsPath `
        -Value ($row | ConvertTo-Json -Depth 12 -Compress) -Encoding utf8
      $status = [string]$row.parity.status
      if (-not $counts.ContainsKey($status)) { throw "Unknown parity status: $status" }
      $counts[$status]++
      $processed++
    }
    Write-Host "offset=$offset processed=$(@($response.results).Count) exact=$($counts.exact_match) policy=$($counts.policy_only_difference) changed=$($counts.source_changed) identity=$($counts.identity_unresolved)"
    Start-Sleep -Milliseconds $DelayMilliseconds
  }

  $summary = [ordered]@{
    expected = 1125
    processed = $processed
    exactMatch = $counts.exact_match
    policyOnlyDifference = $counts.policy_only_difference
    sourceChanged = $counts.source_changed
    identityUnresolved = $counts.identity_unresolved
    pass = $processed -eq 1125 -and $counts.source_changed -eq 0 -and
      $counts.identity_unresolved -eq 0
    output = $OutputDirectory
  }
  $summary | ConvertTo-Json -Depth 5 |
    Set-Content -LiteralPath $summaryPath -Encoding utf8
  $summary | Format-List | Out-String | Write-Host
  if (-not $summary.pass) {
    throw "D10_SOURCE_PARITY_REVIEW_REQUIRED: $OutputDirectory"
  }
}
finally {
  $secret = $null
  $headers = $null
}
