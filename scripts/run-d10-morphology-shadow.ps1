[CmdletBinding()]
param(
  # ASCII-only source keeps the default correct in Windows PowerShell 5.1,
  # which may decode a UTF-8 script without BOM as Windows-1252.
  [string]$LookupWord = "h$([char]0x00E5)pe",

  [ValidateSet('verb', 'noun', 'adjective', 'determiner')]
  [string]$LookupPos = 'verb',

  [ValidateSet('bm', 'nn')]
  [string]$Dictionary = 'bm',

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
  if ([string]::IsNullOrWhiteSpace($encryptedSecret)) {
    throw "Encrypted shadow secret is empty: $resolvedSecretPath"
  }

  $secureSecret = $null
  $plainSecret = $null
  $secretPointer = [IntPtr]::Zero

  try {
    $secureSecret = ConvertTo-SecureString `
      -String $encryptedSecret `
      -ErrorAction Stop
    $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR(
      $secureSecret
    )
    $plainSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
      $secretPointer
    )
    return [regex]::Replace($plainSecret, '\s', '')
  }
  catch {
    throw "Unable to decrypt the D10 shadow secret for this Windows user and machine: $($_.Exception.Message)"
  }
  finally {
    if ($secretPointer -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
    }
    if ($secureSecret) {
      $secureSecret.Dispose()
    }
    $plainSecret = $null
    $encryptedSecret = $null
  }
}

$SecretKey = Get-D10ShadowSecret `
  -ExplicitSecretKey $SecretKey `
  -EncryptedSecretPath $SecretPath

if ($SecretKey -notmatch '^sb_secret_[A-Za-z0-9_-]+$') {
  $SecretKey = $null
  throw 'D10 shadow requires the encrypted modern sb_secret_ key.'
}

$headers = @{ apikey = $SecretKey }
$requestJson = @{
  query = $LookupWord
  pos = $LookupPos
  dictionaries = @($Dictionary)
} | ConvertTo-Json -Compress
$requestBody = [Text.Encoding]::UTF8.GetBytes($requestJson)

try {
  $response = Invoke-RestMethod `
    -Uri "$($SupabaseUrl.TrimEnd('/'))/functions/v1/forms-enrichment-v2-shadow" `
    -Method Post `
    -Headers $headers `
    -ContentType 'application/json; charset=utf-8' `
    -Body $requestBody `
    -TimeoutSec 60

  $preterite = @(
    $response.displayGroups |
      Where-Object { $_.formKey -eq 'preterite' }
  )

  [pscustomobject]@{
    ok = $response.ok
    status = $response.result.status
    persisted = $response.persisted
    dictionary = ($response.result.lookup.requestedDictionaries -join ', ')
    articleIds = (
      $response.result.paradigms.articleId |
        Sort-Object -Unique
    ) -join ', '
    primary = ($preterite.primary.value -join ', ')
    alternatives = ($preterite.alternatives.value -join ', ')
  } | Format-List
}
catch {
  Write-Host 'D10 SHADOW REQUEST FAILED' -ForegroundColor Red
  Write-Host $_.Exception.Message
  if ($_.ErrorDetails.Message) {
    Write-Host $_.ErrorDetails.Message
  }
  throw
}
finally {
  if ($headers) {
    $headers.Clear()
  }
  $headers = $null
  $SecretKey = $null
  $requestBody = $null
  $requestJson = $null
}
