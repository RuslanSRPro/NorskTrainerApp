[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9a-fA-F-]{36}$')]
  [string]$JobId,

  [ValidateRange(0, 1000000)]
  [int]$Offset = 0,

  [ValidateRange(1, 25)]
  [int]$Limit = 25,

  [string]$SupabaseUrl = 'https://kevpkawrbtovrgyjkkvu.supabase.co',
  [string]$SecretKey = $env:SUPABASE_COMPLETION_SHADOW_SECRET,
  [string]$SecretPath = $env:SUPABASE_COMPLETION_SHADOW_SECRET_PATH
)

$ErrorActionPreference = 'Stop'

function Get-D10ShadowSecret {
  param(
    [string]$ExplicitSecretKey,
    [string]$EncryptedSecretPath
  )

  if (-not [string]::IsNullOrWhiteSpace($ExplicitSecretKey)) {
    return [regex]::Replace($ExplicitSecretKey, '\s', '')
  }

  $resolvedSecretPath = $EncryptedSecretPath
  if ([string]::IsNullOrWhiteSpace($resolvedSecretPath)) {
    if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
      throw 'No secret key was provided and LOCALAPPDATA is unavailable.'
    }
    $resolvedSecretPath = Join-Path $env:LOCALAPPDATA `
      'NorskTrainer\secrets\completion-shadow.dpapi'
  }

  if (-not (Test-Path -LiteralPath $resolvedSecretPath -PathType Leaf)) {
    throw "Encrypted shadow secret was not found: $resolvedSecretPath"
  }

  $encryptedSecret = (
    Get-Content -LiteralPath $resolvedSecretPath -Raw -ErrorAction Stop
  ).Trim()
  $secureSecret = $null
  $plainSecret = $null
  $secretPointer = [IntPtr]::Zero

  try {
    $secureSecret = ConvertTo-SecureString -String $encryptedSecret
    $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR(
      $secureSecret
    )
    $plainSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
      $secretPointer
    )
    return [regex]::Replace($plainSecret, '\s', '')
  }
  catch {
    throw "Unable to decrypt the D10 shadow secret: $($_.Exception.Message)"
  }
  finally {
    if ($secretPointer -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
    }
    if ($secureSecret) { $secureSecret.Dispose() }
    $plainSecret = $null
    $encryptedSecret = $null
  }
}

$SecretKey = Get-D10ShadowSecret `
  -ExplicitSecretKey $SecretKey `
  -EncryptedSecretPath $SecretPath
if ($SecretKey -notmatch '^sb_secret_[A-Za-z0-9_-]+$') {
  $SecretKey = $null
  throw 'D10 comparison shadow requires the encrypted modern sb_secret_ key.'
}

$headers = @{ apikey = $SecretKey }
$requestJson = @{
  jobId = $JobId
  offset = $Offset
  limit = $Limit
} | ConvertTo-Json -Compress
$requestBody = [Text.Encoding]::UTF8.GetBytes($requestJson)

try {
  $response = Invoke-RestMethod `
    -Uri "$($SupabaseUrl.TrimEnd('/'))/functions/v1/forms-enrichment-v2-compare-shadow" `
    -Method Post `
    -Headers $headers `
    -ContentType 'application/json; charset=utf-8' `
    -Body $requestBody `
    -TimeoutSec 70

  [pscustomobject]@{
    ok = $response.ok
    comparisonOk = $response.comparisonOk
    jobId = $response.jobId
    jobStatus = $response.jobStatus
    persisted = $response.persisted
    selectedItems = $response.selectedItems
    eligibleLexemes = $response.eligibleLexemes
    hasMore = $response.hasMore
    nextOffset = $response.nextOffset
    workerStatus = $response.workerStatus
    processed = $response.result.processed
    failed = $response.result.failed
  } | Format-List

  @($response.result.results) | ForEach-Object {
    [pscustomobject]@{
      lemma = $_.lemma
      pos = $_.pos
      status = $_.status
      articles = ($_.articleIds -join ', ')
      primary = $_.primaryCount
      alternatives = $_.alternativeCount
      matchesLegacy = $_.comparison.matches
      v2Count = $_.comparison.v2Count
      legacyCount = $_.comparison.legacyCount
      onlyV2 = ($_.comparison.onlyV2 -join '; ')
      onlyLegacy = ($_.comparison.onlyLegacy -join '; ')
    }
  } | Format-Table -AutoSize -Wrap
}
catch {
  Write-Host 'D10 COMPARISON SHADOW REQUEST FAILED' -ForegroundColor Red
  Write-Host $_.Exception.Message
  if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
  elseif ($_.Exception.Response) {
    $errorStream = $_.Exception.Response.GetResponseStream()
    if ($errorStream) {
      $errorReader = New-Object System.IO.StreamReader($errorStream)
      try {
        $errorBody = $errorReader.ReadToEnd()
        if (-not [string]::IsNullOrWhiteSpace($errorBody)) {
          Write-Host $errorBody
        }
      }
      finally {
        $errorReader.Dispose()
      }
    }
  }
  throw
}
finally {
  if ($headers) { $headers.Clear() }
  $headers = $null
  $SecretKey = $null
  $requestBody = $null
  $requestJson = $null
}
