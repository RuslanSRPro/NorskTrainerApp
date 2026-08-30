[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [Guid]$JobId,

  [string]$SupabaseUrl = $env:SUPABASE_URL,
  [string]$SecretKey = $env:SUPABASE_COMPLETION_SHADOW_SECRET,
  [string]$SecretPath = $env:SUPABASE_COMPLETION_SHADOW_SECRET_PATH,

  [ValidateRange(1, 50)]
  [int]$PageLimit = 20,

  [ValidateRange(1, 1000)]
  [int]$MaxPages = 100,

  [switch]$IncludeAssessments,
  [string]$OutputPath
)

$ErrorActionPreference = 'Stop'

function Get-CompletionShadowSecret {
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
    throw "Encrypted completion shadow secret was not found: $resolvedSecretPath"
  }

  $encryptedSecret = (
    Get-Content -LiteralPath $resolvedSecretPath -Raw -ErrorAction Stop
  ).Trim()
  if ([string]::IsNullOrWhiteSpace($encryptedSecret)) {
    throw "Encrypted completion shadow secret is empty: $resolvedSecretPath"
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
    throw "Unable to decrypt completion shadow secret for this Windows user and machine: $($_.Exception.Message)"
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

if ([string]::IsNullOrWhiteSpace($SupabaseUrl)) {
  throw 'SUPABASE_URL is required.'
}

$SecretKey = Get-CompletionShadowSecret `
  -ExplicitSecretKey $SecretKey `
  -EncryptedSecretPath $SecretPath

if ($SecretKey -notmatch '^sb_secret_[A-Za-z0-9_-]+$') {
  $SecretKey = $null
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

try {
  $response = Invoke-RestMethod `
    -Method Post `
    -Uri $uri `
    -Headers $headers `
    -ContentType 'application/json' `
    -Body $body
}
finally {
  $headers.Clear()
  $headers = $null
  $SecretKey = $null
}

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
