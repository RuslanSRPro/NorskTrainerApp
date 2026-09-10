[CmdletBinding()]
param(
  [ValidateRange(0, 1000)]
  [int]$MaxItems = 25,

  [ValidateRange(0, 10000)]
  [int]$DelayMilliseconds = 500,

  [ValidateRange(1, 5)]
  [int]$RetryCount = 3,

  [string]$AmbiguousReviewPath = (
    Join-Path ([Environment]::GetFolderPath('UserProfile')) `
      'Downloads\d10-morphology-preflight-smoke-20260909-211849\ambiguous-review.csv'
  ),

  [string]$EvidencePath = (
    Join-Path ([Environment]::GetFolderPath('UserProfile')) `
      'Downloads\d10-supported-lexeme-evidence-json.csv'
  ),

  [string]$OutputDirectory = (
    Join-Path ([Environment]::GetFolderPath('UserProfile')) `
      'Downloads\d10-ambiguous-article-diagnostic'
  ),

  [string]$SupabaseUrl = 'https://kevpkawrbtovrgyjkkvu.supabase.co',
  [string]$SecretKey = $env:SUPABASE_COMPLETION_SHADOW_SECRET,
  [string]$SecretPath = $env:SUPABASE_COMPLETION_SHADOW_SECRET_PATH
)

$ErrorActionPreference = 'Stop'
$ExpectedAmbiguousCount = 99
$ExpectedDiagnosticCount = 97
$SupportedPos = @('verb', 'noun', 'adjective', 'determiner')
$KnownBindings = @{
  'd3fdd671-8fd2-43bf-b399-dd140ce0e704' = @{
    lemma = 'v' + [char]0x00E6 + 're'
    pos = 'verb'
    selectedArticleId = '69211'
    rejectedArticleId = '69212'
  }
  'e77c1dd7-9c6e-4af8-b80c-4b673132dfa0' = @{
    lemma = 'bli'
    pos = 'verb'
    selectedArticleId = '6390'
    rejectedArticleId = '6460'
  }
}

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

function ConvertTo-StringArray {
  param([object]$Value)

  return @(
    @($Value) |
      ForEach-Object { [string]$_ } |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
      Sort-Object -Unique
  )
}

function Get-CandidateArticleIds {
  param([object]$Candidate)

  return @(
    ([string]$Candidate.articleIds).Split(',') |
      ForEach-Object { $_.Trim() } |
      Where-Object { $_ } |
      Sort-Object -Unique
  )
}

function Assert-ExactStringSet {
  param(
    [string[]]$Actual,
    [string[]]$Expected,
    [string]$FailureCode
  )

  $actualNormalized = @(ConvertTo-StringArray -Value $Actual)
  $expectedNormalized = @(ConvertTo-StringArray -Value $Expected)
  if (
    $actualNormalized.Count -ne $expectedNormalized.Count -or
    (Compare-Object $actualNormalized $expectedNormalized).Count -ne 0
  ) {
    throw $FailureCode
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

function ConvertTo-DiagnosticRecord {
  param(
    [object]$Candidate,
    [object]$Evidence,
    [object]$Response
  )

  if (
    $Response.function -ne 'forms-enrichment-v2-shadow' -or
    $Response.mode -ne 'shadow' -or
    $Response.sourceOnly -ne $true -or
    $Response.persisted -ne $false -or
    $Response.result.version -ne 'authoritative-morphology/v2.2' -or
    $Response.result.status -ne 'resolved'
  ) {
    throw 'SHADOW_CONTRACT_VIOLATION'
  }

  $requestedDictionaries = @(
    $Response.result.lookup.requestedDictionaries
  )
  Assert-ExactStringSet `
    -Actual $requestedDictionaries `
    -Expected @('bm') `
    -FailureCode 'BOKMAL_REQUEST_CONTRACT_VIOLATION'

  if ([string]$Response.result.requestedPos -ne [string]$Candidate.pos) {
    throw 'REQUESTED_POS_CONTRACT_VIOLATION'
  }

  $expectedArticleIds = @(Get-CandidateArticleIds -Candidate $Candidate)
  if ($expectedArticleIds.Count -lt 2) {
    throw 'AMBIGUOUS_CANDIDATE_ARTICLE_COUNT_VIOLATION'
  }

  $displayGroups = @($Response.displayGroups)
  $wrongGroups = @(
    $displayGroups |
      Where-Object {
        $_.dictionaryCode -ne 'bm' -or
        $_.pos -ne [string]$Candidate.pos
      }
  )
  if ($wrongGroups.Count -gt 0) {
    throw 'DISPLAY_GROUP_DICTIONARY_OR_POS_VIOLATION'
  }

  $actualArticleIds = @(
    $displayGroups.articleId |
      ForEach-Object { [string]$_ } |
      Sort-Object -Unique
  )
  Assert-ExactStringSet `
    -Actual $actualArticleIds `
    -Expected $expectedArticleIds `
    -FailureCode 'ARTICLE_SET_DRIFT'

  $lookupArticles = @($Response.result.lookup.articles)
  $selectedArticles = @(
    foreach ($articleId in $expectedArticleIds) {
      $matches = @(
        $lookupArticles |
          Where-Object {
            $_.dictionaryCode -eq 'bm' -and
            [string]$_.articleId -eq $articleId
          }
      )
      if ($matches.Count -ne 1) {
        throw "ARTICLE_PAYLOAD_CARDINALITY_VIOLATION:$articleId"
      }
      [ordered]@{
        dictionaryCode = 'bm'
        articleId = $articleId
        sourceUrl = [string]$matches[0].sourceUrl
        payload = $matches[0].payload
      }
    }
  )

  return [ordered]@{
    lexemeId = [string]$Candidate.lexemeId
    lemma = [string]$Candidate.lemma
    pos = [string]$Candidate.pos
    resolution = [string]$Candidate.resolution
    expectedArticleIds = $expectedArticleIds
    learnerEvidence = [ordered]@{
      displayForm = $Evidence.display_form
      translationUa = $Evidence.translation_ua
      translationEn = $Evidence.translation_en
      example = $Evidence.example
      notes = $Evidence.notes
      cefr = $Evidence.cefr
      verificationStatus = $Evidence.verification_status
      verificationTier = $Evidence.verification_tier
      sourceVerified = $Evidence.source_verified
      verificationVersion = $Evidence.verification_version
    }
    articles = $selectedArticles
    checkedAt = [DateTime]::UtcNow.ToString('o')
    sourceOnly = $true
    persisted = $false
  }
}

foreach ($path in @($AmbiguousReviewPath, $EvidencePath)) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Required input file was not found: $path"
  }
}

$ambiguousRows = @(Import-Csv -LiteralPath $AmbiguousReviewPath)
if ($ambiguousRows.Count -ne $ExpectedAmbiguousCount) {
  throw "Expected $ExpectedAmbiguousCount ambiguous rows, found $($ambiguousRows.Count)."
}

$ambiguousIds = [Collections.Generic.HashSet[string]]::new(
  [StringComparer]::OrdinalIgnoreCase
)
foreach ($candidate in $ambiguousRows) {
  $parsedId = [Guid]::Empty
  if (-not [Guid]::TryParse([string]$candidate.lexemeId, [ref]$parsedId)) {
    throw "Invalid ambiguous lexeme UUID: $($candidate.lexemeId)"
  }
  if (-not $ambiguousIds.Add([string]$candidate.lexemeId)) {
    throw "Duplicate ambiguous lexeme UUID: $($candidate.lexemeId)"
  }
  if ([string]$candidate.resolution -ne 'ambiguous_source_articles') {
    throw "Unexpected resolution for $($candidate.lexemeId)."
  }
  if ($SupportedPos -notcontains [string]$candidate.pos) {
    throw "Unsupported POS for $($candidate.lexemeId): $($candidate.pos)"
  }
  if (@(Get-CandidateArticleIds -Candidate $candidate).Count -lt 2) {
    throw "Ambiguous row has fewer than two articles: $($candidate.lexemeId)"
  }
}

foreach ($entry in $KnownBindings.GetEnumerator()) {
  $matches = @(
    $ambiguousRows |
      Where-Object { [string]$_.lexemeId -eq [string]$entry.Key }
  )
  if ($matches.Count -ne 1) {
    throw "Known binding is absent from ambiguity input: $($entry.Key)"
  }
  $binding = $entry.Value
  if (
    [string]$matches[0].lemma -ne [string]$binding.lemma -or
    [string]$matches[0].pos -ne [string]$binding.pos
  ) {
    throw "Known binding dimensions differ: $($entry.Key)"
  }
  Assert-ExactStringSet `
    -Actual @(Get-CandidateArticleIds -Candidate $matches[0]) `
    -Expected @(
      [string]$binding.selectedArticleId,
      [string]$binding.rejectedArticleId
    ) `
    -FailureCode "KNOWN_BINDING_ARTICLE_SET_DRIFT:$($entry.Key)"
}

$evidenceExport = @(Import-Csv -LiteralPath $EvidencePath)
if ($evidenceExport.Count -ne 1) {
  throw "Expected one aggregate evidence row, found $($evidenceExport.Count)."
}
if ([int]$evidenceExport[0].lexeme_count -ne 1580) {
  throw "Expected evidence lexeme_count=1580, found $($evidenceExport[0].lexeme_count)."
}

$parsedEvidence = ConvertFrom-Json `
  -InputObject ([string]$evidenceExport[0].evidence_payload)
$evidenceRows = @($parsedEvidence | ForEach-Object { $_ })
if ($evidenceRows.Count -ne 1580) {
  throw "Expected 1580 evidence objects, found $($evidenceRows.Count)."
}

$evidenceById = @{}
foreach ($evidence in $evidenceRows) {
  $id = [string]$evidence.lexeme_id
  if ($evidenceById.ContainsKey($id)) {
    throw "Duplicate evidence lexeme UUID: $id"
  }
  $evidenceById[$id] = $evidence
}

$targets = @(
  $ambiguousRows |
    Where-Object { -not $KnownBindings.ContainsKey([string]$_.lexemeId) } |
    Sort-Object -Property lexemeId
)
if ($targets.Count -ne $ExpectedDiagnosticCount) {
  throw "Expected $ExpectedDiagnosticCount diagnostic targets, found $($targets.Count)."
}
foreach ($target in $targets) {
  if (-not $evidenceById.ContainsKey([string]$target.lexemeId)) {
    throw "Learner evidence is absent: $($target.lexemeId)"
  }
  $evidence = $evidenceById[[string]$target.lexemeId]
  if (
    [string]$evidence.lemma -ne [string]$target.lemma -or
    [string]$evidence.pos -ne [string]$target.pos
  ) {
    throw "Learner evidence dimensions differ: $($target.lexemeId)"
  }
}

$SecretKey = Get-D10ShadowSecret `
  -ExplicitSecretKey $SecretKey `
  -EncryptedSecretPath $SecretPath
if ($SecretKey -notmatch '^sb_secret_[A-Za-z0-9_-]+$') {
  $SecretKey = $null
  throw 'D10 diagnostic requires the encrypted modern sb_secret_ key.'
}

$headers = @{ apikey = $SecretKey }
$checkpointPath = Join-Path $OutputDirectory 'article-diagnostic.jsonl'
$summaryPath = Join-Path $OutputDirectory 'summary.json'

try {
  New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

  $completed = [Collections.Generic.HashSet[string]]::new(
    [StringComparer]::OrdinalIgnoreCase
  )
  $checkpointRows = @()
  if (Test-Path -LiteralPath $checkpointPath -PathType Leaf) {
    foreach ($line in Get-Content -LiteralPath $checkpointPath) {
      if ([string]::IsNullOrWhiteSpace($line)) {
        continue
      }
      $record = $line | ConvertFrom-Json
      if (
        $record.sourceOnly -ne $true -or
        $record.persisted -ne $false -or
        -not $ambiguousIds.Contains([string]$record.lexemeId) -or
        $KnownBindings.ContainsKey([string]$record.lexemeId)
      ) {
        throw "Invalid diagnostic checkpoint row: $($record.lexemeId)"
      }
      if (-not $completed.Add([string]$record.lexemeId)) {
        throw "Duplicate diagnostic checkpoint row: $($record.lexemeId)"
      }
      $checkpointRows += $record
    }
  }

  $pending = @(
    $targets |
      Where-Object { -not $completed.Contains([string]$_.lexemeId) }
  )
  if ($MaxItems -gt 0) {
    $pending = @($pending | Select-Object -First $MaxItems)
  }

  Write-Host '=== D10 AMBIGUOUS ARTICLE DIAGNOSTIC ==='
  Write-Host "Raw ambiguous rows:  $($ambiguousRows.Count)"
  Write-Host "Known bindings:       $($KnownBindings.Count)"
  Write-Host "Diagnostic targets:   $($targets.Count)"
  Write-Host "Checkpoint rows:      $($checkpointRows.Count)"
  Write-Host "This run:             $($pending.Count)"

  $position = 0
  foreach ($candidate in $pending) {
    $position++
    Write-Host "[$position/$($pending.Count)] $($candidate.lemma) / $($candidate.pos)"
    $response = Invoke-D10ShadowRequest `
      -Candidate $candidate `
      -Headers $headers
    $record = ConvertTo-DiagnosticRecord `
      -Candidate $candidate `
      -Evidence $evidenceById[[string]$candidate.lexemeId] `
      -Response $response

    $record | ConvertTo-Json -Depth 100 -Compress |
      Add-Content -LiteralPath $checkpointPath -Encoding UTF8
    $checkpointRows += [pscustomobject]$record
    [void]$completed.Add([string]$record.lexemeId)
    Write-Host "  -> captured $(@($record.articles).Count) exact BM articles"

    if ($DelayMilliseconds -gt 0) {
      Start-Sleep -Milliseconds $DelayMilliseconds
    }
  }

  $completedTargetCount = @(
    $targets |
      Where-Object { $completed.Contains([string]$_.lexemeId) }
  ).Count
  $summary = [ordered]@{
    generatedAt = [DateTime]::UtcNow.ToString('o')
    sourceOnly = $true
    persisted = $false
    rawAmbiguousRows = $ambiguousRows.Count
    excludedKnownBindings = @(
      $KnownBindings.Keys | Sort-Object
    )
    diagnosticTargets = $targets.Count
    checkpointRows = $checkpointRows.Count
    completedTargets = $completedTargetCount
    remaining = [Math]::Max(0, $targets.Count - $completedTargetCount)
  }
  $summary | ConvertTo-Json -Depth 8 |
    Set-Content -LiteralPath $summaryPath -Encoding UTF8

  Write-Host '=== DIAGNOSTIC SUMMARY ==='
  $summary | ConvertTo-Json -Depth 8
  Write-Host "Checkpoint: $checkpointPath"
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
