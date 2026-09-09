[CmdletBinding()]
param(
  [ValidateRange(0, 10000)]
  [int]$MaxItems = 50,

  [ValidateRange(0, 10000)]
  [int]$DelayMilliseconds = 250,

  [ValidateRange(1, 5)]
  [int]$RetryCount = 3,

  [string]$CandidatesPath = (
    Join-Path ([Environment]::GetFolderPath('UserProfile')) `
      'Downloads\d10-supported-lexemes.csv'
  ),

  [string]$OutputDirectory = (
    Join-Path ([Environment]::GetFolderPath('UserProfile')) `
      'Downloads\d10-morphology-preflight'
  ),

  [string]$SupabaseUrl = 'https://kevpkawrbtovrgyjkkvu.supabase.co',
  [string]$SecretKey = $env:SUPABASE_COMPLETION_SHADOW_SECRET,
  [string]$SecretPath = $env:SUPABASE_COMPLETION_SHADOW_SECRET_PATH
)

$ErrorActionPreference = 'Stop'
$SupportedPos = @('verb', 'noun', 'adjective', 'determiner')

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
    throw "Unable to decrypt the D10 shadow secret: $($_.Exception.Message)"
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

function Get-D10ArticleSignature {
  param([object[]]$Groups)

  $projection = @(
    $Groups |
      Sort-Object -Property formKey |
      ForEach-Object {
        [ordered]@{
          formKey = [string]$_.formKey
          primary = @(
            $_.primary.normalizedValue |
              Where-Object { $_ } |
              Sort-Object -Unique
          )
          alternatives = @(
            $_.alternatives.normalizedValue |
              Where-Object { $_ } |
              Sort-Object -Unique
          )
          regularityMarker = [string]$_.regularityMarker
          policyVersion = [string]$_.policyVersion
        }
      }
  )
  return $projection | ConvertTo-Json -Depth 8 -Compress
}

function Resolve-D10ArticleProjection {
  param([object[]]$Groups)

  $articleIds = @(
    $Groups.articleId |
      Where-Object { $_ } |
      ForEach-Object { [string]$_ } |
      Sort-Object -Unique
  )
  if ($articleIds.Count -eq 0) {
    return [pscustomobject]@{
      status = 'failed'
      resolution = 'no_source_article'
      articleIds = @()
    }
  }

  if ($articleIds.Count -eq 1) {
    return [pscustomobject]@{
      status = 'resolved'
      resolution = 'single_source_article'
      articleIds = $articleIds
    }
  }

  $signatures = @(
    foreach ($articleId in $articleIds) {
      $articleGroups = @(
        $Groups | Where-Object { [string]$_.articleId -eq $articleId }
      )
      Get-D10ArticleSignature -Groups $articleGroups
    }
  )
  $equivalent = @($signatures | Sort-Object -Unique).Count -eq 1

  return [pscustomobject]@{
    status = if ($equivalent) { 'resolved' } else { 'ambiguous' }
    resolution = if ($equivalent) {
      'equivalent_source_articles'
    } else {
      'ambiguous_source_articles'
    }
    articleIds = $articleIds
  }
}

function Invoke-D10ShadowRequest {
  param(
    [object]$Candidate,
    [hashtable]$Headers
  )

  $requestJson = @{
    query = [string]$Candidate.lemma
    pos = [string]$Candidate.pos
    dictionaries = @('bm')
  } | ConvertTo-Json -Compress
  $requestBody = [Text.Encoding]::UTF8.GetBytes($requestJson)

  for ($attempt = 1; $attempt -le $RetryCount; $attempt++) {
    try {
      return Invoke-RestMethod `
        -Uri "$($SupabaseUrl.TrimEnd('/'))/functions/v1/forms-enrichment-v2-shadow" `
        -Method Post `
        -Headers $Headers `
        -ContentType 'application/json; charset=utf-8' `
        -Body $requestBody `
        -TimeoutSec 60
    }
    catch {
      if ($attempt -eq $RetryCount) {
        throw
      }
      Start-Sleep -Seconds ([Math]::Min(8, [Math]::Pow(2, $attempt)))
    }
  }
}

function ConvertTo-D10CheckpointResult {
  param(
    [object]$Candidate,
    [object]$Response
  )

  if (
    $Response.function -ne 'forms-enrichment-v2-shadow' -or
    $Response.mode -ne 'shadow' -or
    $Response.sourceOnly -ne $true -or
    $Response.persisted -ne $false -or
    $Response.result.version -ne 'authoritative-morphology/v2.2'
  ) {
    throw 'SHADOW_CONTRACT_VIOLATION'
  }

  $requestedDictionaries = @($Response.result.lookup.requestedDictionaries)
  $nonBokmalParadigms = @(
    $Response.result.paradigms |
      Where-Object { $_.dictionaryCode -ne 'bm' }
  )
  $nonBokmalGroups = @(
    $Response.displayGroups |
      Where-Object { $_.dictionaryCode -ne 'bm' }
  )
  if (
    $requestedDictionaries.Count -ne 1 -or
    $requestedDictionaries[0] -ne 'bm' -or
    $nonBokmalParadigms.Count -gt 0 -or
    $nonBokmalGroups.Count -gt 0
  ) {
    throw 'BOKMAL_ONLY_CONTRACT_VIOLATION'
  }

  $sourceStatus = [string]$Response.result.status
  if ($sourceStatus -eq 'not_found') {
    return [ordered]@{
      lexemeId = [string]$Candidate.id
      lemma = [string]$Candidate.lemma
      pos = [string]$Candidate.pos
      status = 'not_found'
      resolution = 'not_found'
      articleIds = @()
      displayRows = 0
      checkedAt = [DateTime]::UtcNow.ToString('o')
    }
  }

  if ($sourceStatus -ne 'resolved') {
    return [ordered]@{
      lexemeId = [string]$Candidate.id
      lemma = [string]$Candidate.lemma
      pos = [string]$Candidate.pos
      status = 'failed'
      resolution = "source_status_$sourceStatus"
      articleIds = @($Response.result.paradigms.articleId | Sort-Object -Unique)
      displayRows = @($Response.displayGroups).Count
      checkedAt = [DateTime]::UtcNow.ToString('o')
    }
  }

  $projection = Resolve-D10ArticleProjection -Groups @($Response.displayGroups)
  return [ordered]@{
    lexemeId = [string]$Candidate.id
    lemma = [string]$Candidate.lemma
    pos = [string]$Candidate.pos
    status = [string]$projection.status
    resolution = [string]$projection.resolution
    articleIds = @($projection.articleIds)
    displayRows = @($Response.displayGroups).Count
    checkedAt = [DateTime]::UtcNow.ToString('o')
  }
}

$SecretKey = Get-D10ShadowSecret `
  -ExplicitSecretKey $SecretKey `
  -EncryptedSecretPath $SecretPath

if ($SecretKey -notmatch '^sb_secret_[A-Za-z0-9_-]+$') {
  $SecretKey = $null
  throw 'D10 preflight requires the encrypted modern sb_secret_ key.'
}

$headers = @{ apikey = $SecretKey }
$checkpointPath = Join-Path $OutputDirectory 'checkpoint.jsonl'
$summaryPath = Join-Path $OutputDirectory 'summary.json'
$csvPath = Join-Path $OutputDirectory 'results.csv'

try {
  New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

  Write-Host '=== LOAD EXPORTED SUPPORTED LEARNING LEXEMES ==='
  if (-not (Test-Path -LiteralPath $CandidatesPath -PathType Leaf)) {
    throw "Candidates CSV was not found: $CandidatesPath"
  }
  $lexemes = @(Import-Csv -LiteralPath $CandidatesPath)
  if ($lexemes.Count -eq 0) {
    throw 'Candidates CSV is empty.'
  }

  $uniqueLexemeIds = [Collections.Generic.HashSet[string]]::new(
    [StringComparer]::OrdinalIgnoreCase
  )
  foreach ($lexeme in $lexemes) {
    $parsedId = [Guid]::Empty
    if (-not [Guid]::TryParse([string]$lexeme.id, [ref]$parsedId)) {
      throw "Invalid lexeme UUID in candidates CSV: $($lexeme.id)"
    }
    if ([string]::IsNullOrWhiteSpace([string]$lexeme.lemma)) {
      throw "Empty lemma in candidates CSV: $($lexeme.id)"
    }
    if ($SupportedPos -notcontains [string]$lexeme.pos) {
      throw "Unsupported POS in candidates CSV: $($lexeme.pos)"
    }
    if (-not $uniqueLexemeIds.Add([string]$lexeme.id)) {
      throw "Duplicate lexeme UUID in candidates CSV: $($lexeme.id)"
    }
  }

  $completed = [Collections.Generic.HashSet[string]]::new(
    [StringComparer]::OrdinalIgnoreCase
  )
  $checkpointRows = @()
  if (Test-Path -LiteralPath $checkpointPath -PathType Leaf) {
    foreach ($line in Get-Content -LiteralPath $checkpointPath) {
      if ([string]::IsNullOrWhiteSpace($line)) {
        continue
      }
      try {
        $checkpointRow = $line | ConvertFrom-Json
        $checkpointRows += $checkpointRow
        [void]$completed.Add([string]$checkpointRow.lexemeId)
      }
      catch {
        throw "Invalid checkpoint line: $line"
      }
    }
  }

  $targets = @($lexemes | Sort-Object -Property id)
  $pending = @(
    $targets | Where-Object { -not $completed.Contains([string]$_.id) }
  )
  if ($MaxItems -gt 0) {
    $pending = @($pending | Select-Object -First $MaxItems)
  }

  Write-Host "Supported lexemes: $($lexemes.Count)"
  Write-Host "Target lexemes:   $($targets.Count)"
  Write-Host "Checkpoint rows:  $($checkpointRows.Count)"
  Write-Host "This run:         $($pending.Count)"

  $position = 0
  foreach ($candidate in $pending) {
    $position++
    Write-Host "[$position/$($pending.Count)] $($candidate.lemma) / $($candidate.pos)"

    try {
      $response = Invoke-D10ShadowRequest `
        -Candidate $candidate `
        -Headers $headers
      $result = ConvertTo-D10CheckpointResult `
        -Candidate $candidate `
        -Response $response
    }
    catch {
      $result = [ordered]@{
        lexemeId = [string]$candidate.id
        lemma = [string]$candidate.lemma
        pos = [string]$candidate.pos
        status = 'failed'
        resolution = 'request_failed'
        articleIds = @()
        displayRows = 0
        error = [string]$_.Exception.Message
        checkedAt = [DateTime]::UtcNow.ToString('o')
      }
    }

    $result | ConvertTo-Json -Depth 8 -Compress |
      Add-Content -LiteralPath $checkpointPath -Encoding UTF8
    $checkpointRows += [pscustomobject]$result
    [void]$completed.Add([string]$result.lexemeId)
    Write-Host "  -> $($result.status) / $($result.resolution)"

    if ($DelayMilliseconds -gt 0) {
      Start-Sleep -Milliseconds $DelayMilliseconds
    }
  }

  $checkpointRows |
    Select-Object `
      lexemeId, lemma, pos, status, resolution,
      @{ Name = 'articleIds'; Expression = { $_.articleIds -join ',' } },
      displayRows, checkedAt, error |
    Export-Csv -LiteralPath $csvPath -NoTypeInformation -Encoding UTF8

  $statusCounts = [ordered]@{}
  foreach ($group in @($checkpointRows | Group-Object -Property status)) {
    $statusCounts[[string]$group.Name] = $group.Count
  }
  $completedTargetCount = @(
    $targets | Where-Object { $completed.Contains([string]$_.id) }
  ).Count
  $summary = [ordered]@{
    generatedAt = [DateTime]::UtcNow.ToString('o')
    sourceOnly = $true
    persisted = $false
    supportedLexemes = $lexemes.Count
    candidatesPath = $CandidatesPath
    targetLexemes = $targets.Count
    checkpointRows = $checkpointRows.Count
    completedTargets = $completedTargetCount
    remaining = [Math]::Max(0, $targets.Count - $completedTargetCount)
    statusCounts = $statusCounts
  }
  $summary | ConvertTo-Json -Depth 8 |
    Set-Content -LiteralPath $summaryPath -Encoding UTF8

  Write-Host '=== PREFLIGHT SUMMARY ==='
  $summary | ConvertTo-Json -Depth 8
  Write-Host "Checkpoint: $checkpointPath"
  Write-Host "CSV:        $csvPath"
  Write-Host "Summary:    $summaryPath"
  Write-Host 'No persistence was requested.'
}
finally {
  if ($headers) {
    $headers.Clear()
  }
  $headers = $null
  $SecretKey = $null
}
