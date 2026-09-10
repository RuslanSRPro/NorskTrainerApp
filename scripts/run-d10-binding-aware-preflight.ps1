[CmdletBinding()]
param(
  [string]$FixturePath = (
    Join-Path $PSScriptRoot 'fixtures\d10-binding-aware-preflight-75.csv'
  ),

  [string]$OutputDirectory = (
    Join-Path ([Environment]::GetFolderPath('UserProfile')) (
      'Downloads\d10-binding-aware-preflight-' +
      [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss')
    )
  ),

  [ValidateRange(1, 5)]
  [int]$RetryCount = 3,

  [ValidateRange(0, 10000)]
  [int]$DelayMilliseconds = 500,

  [string]$SupabaseUrl = 'https://kevpkawrbtovrgyjkkvu.supabase.co',
  [string]$SecretKey = $env:SUPABASE_COMPLETION_SHADOW_SECRET,
  [string]$SecretPath = $env:SUPABASE_COMPLETION_SHADOW_SECRET_PATH
)

$ErrorActionPreference = 'Stop'
$BatchSize = 25
$ExpectedRows = 75
$ExpectedStatus = 'resolved_bound_source_article'
$ExpectedProjectionStatus = 'bound_source_article'
$ExpectedProvider = 'authoritative-article-binding/v1'
$SupportedPos = @('verb', 'noun', 'adjective', 'determiner')

function Get-D10WorkerSecret {
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
    throw "Encrypted worker secret was not found: $resolvedSecretPath"
  }

  $encryptedSecret = (
    Get-Content -LiteralPath $resolvedSecretPath -Raw -ErrorAction Stop
  ).Trim()
  if ([string]::IsNullOrWhiteSpace($encryptedSecret)) {
    throw "Encrypted worker secret is empty: $resolvedSecretPath"
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
    throw "Unable to decrypt the D10 worker secret: $($_.Exception.Message)"
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

function ConvertTo-D10StringSet {
  param([object]$Value)

  return @(
    @($Value) |
      ForEach-Object { [string]$_ } |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
      Sort-Object -Unique
  )
}

function Get-D10RejectedArticleIds {
  param([object]$FixtureRow)

  if (
    [string]::IsNullOrWhiteSpace(
      [string]$FixtureRow.rejected_article_ids
    )
  ) {
    return @()
  }

  return @(
    ([string]$FixtureRow.rejected_article_ids).Split('|') |
      ForEach-Object { $_.Trim() } |
      Where-Object { $_ } |
      Sort-Object -Unique
  )
}

function Assert-D10ExactStringSet {
  param(
    [string[]]$Actual,
    [string[]]$Expected,
    [string]$FailureCode
  )

  $actualNormalized = @(ConvertTo-D10StringSet -Value $Actual)
  $expectedNormalized = @(ConvertTo-D10StringSet -Value $Expected)
  if (
    $actualNormalized.Count -ne $expectedNormalized.Count -or
    @(Compare-Object $actualNormalized $expectedNormalized).Count -ne 0
  ) {
    throw $FailureCode
  }
}

function Invoke-D10WorkerBatch {
  param(
    [string[]]$LexemeIds,
    [hashtable]$Headers
  )

  if ($LexemeIds.Count -ne $BatchSize) {
    throw "BATCH_SIZE_VIOLATION:$($LexemeIds.Count)"
  }

  $requestJson = @{
    lexemeIds = @($LexemeIds)
    persist = $false
  } | ConvertTo-Json -Depth 4 -Compress
  $requestBody = [Text.Encoding]::UTF8.GetBytes($requestJson)

  try {
    for ($attempt = 1; $attempt -le $RetryCount; $attempt++) {
      try {
        return Invoke-RestMethod `
          -Uri "$($SupabaseUrl.TrimEnd('/'))/functions/v1/forms-enrichment-v2-worker" `
          -Method Post `
          -Headers $Headers `
          -ContentType 'application/json; charset=utf-8' `
          -Body $requestBody `
          -TimeoutSec 120
      }
      catch {
        if ($attempt -eq $RetryCount) {
          throw
        }
        Start-Sleep -Seconds ([Math]::Min(8, [Math]::Pow(2, $attempt)))
      }
    }
  }
  finally {
    $requestBody = $null
    $requestJson = $null
  }
}

if (-not (Test-Path -LiteralPath $FixturePath -PathType Leaf)) {
  throw "Binding fixture was not found: $FixturePath"
}

$fixtureRows = @(Import-Csv -LiteralPath $FixturePath)
if ($fixtureRows.Count -ne $ExpectedRows) {
  throw "Expected $ExpectedRows binding rows, found $($fixtureRows.Count)."
}

$fixtureRows = @($fixtureRows | Sort-Object { [int]$_.rollout_order })
$uniqueLexemeIds = [Collections.Generic.HashSet[string]]::new(
  [StringComparer]::OrdinalIgnoreCase
)

for ($index = 0; $index -lt $fixtureRows.Count; $index++) {
  $row = $fixtureRows[$index]
  $expectedOrder = $index + 1
  if ([int]$row.rollout_order -ne $expectedOrder) {
    throw "ROLLOUT_ORDER_VIOLATION:$($row.rollout_order)"
  }

  $parsedLexemeId = [Guid]::Empty
  if (
    -not [Guid]::TryParse(
      [string]$row.lexeme_id,
      [ref]$parsedLexemeId
    )
  ) {
    throw "INVALID_LEXEME_UUID:$($row.lexeme_id)"
  }
  if (-not $uniqueLexemeIds.Add([string]$row.lexeme_id)) {
    throw "DUPLICATE_LEXEME_UUID:$($row.lexeme_id)"
  }
  if ([string]::IsNullOrWhiteSpace([string]$row.lemma)) {
    throw "EMPTY_LEMMA:$($row.lexeme_id)"
  }
  if ($SupportedPos -notcontains [string]$row.pos) {
    throw "UNSUPPORTED_POS:$($row.lexeme_id):$($row.pos)"
  }

  $parsedArticleId = 0L
  if (
    -not [long]::TryParse(
      [string]$row.expected_article_id,
      [ref]$parsedArticleId
    ) -or
    $parsedArticleId -le 0
  ) {
    throw "INVALID_EXPECTED_ARTICLE_ID:$($row.lexeme_id)"
  }

  $rejectedIds = @(Get-D10RejectedArticleIds -FixtureRow $row)
  if ($rejectedIds.Count -eq 0) {
    throw "REJECTED_ARTICLE_SET_EMPTY:$($row.lexeme_id)"
  }
  foreach ($rejectedId in $rejectedIds) {
    $parsedRejectedId = 0L
    if (
      -not [long]::TryParse([string]$rejectedId, [ref]$parsedRejectedId) -or
      $parsedRejectedId -le 0
    ) {
      throw "INVALID_REJECTED_ARTICLE_ID:$($row.lexeme_id):$rejectedId"
    }
  }
  if ($rejectedIds -contains [string]$row.expected_article_id) {
    throw "ACCEPTED_ARTICLE_IS_REJECTED:$($row.lexeme_id)"
  }
  if ([string]::IsNullOrWhiteSpace([string]$row.semantic_evidence)) {
    throw "EMPTY_SEMANTIC_EVIDENCE:$($row.lexeme_id)"
  }
}

$knownBindings = @{
  'd3fdd671-8fd2-43bf-b399-dd140ce0e704' = @{
    lemma = 'v' + [char]0x00E6 + 're'
    pos = 'verb'
    expectedArticleId = '69211'
    rejectedArticleIds = @('69212')
    semanticEvidence = 'vaere-be'
  }
  'e77c1dd7-9c6e-4af8-b80c-4b673132dfa0' = @{
    lemma = 'bli'
    pos = 'verb'
    expectedArticleId = '6390'
    rejectedArticleIds = @('6460')
    semanticEvidence = 'bli-become-stay-passive'
  }
}

foreach ($entry in $knownBindings.GetEnumerator()) {
  $matches = @(
    $fixtureRows |
      Where-Object { [string]$_.lexeme_id -ieq [string]$entry.Key }
  )
  if ($matches.Count -ne 1) {
    throw "KNOWN_BINDING_CARDINALITY_VIOLATION:$($entry.Key)"
  }
  $binding = $entry.Value
  if (
    [string]$matches[0].lemma -ne [string]$binding.lemma -or
    [string]$matches[0].pos -ne [string]$binding.pos -or
    [string]$matches[0].expected_article_id -ne
      [string]$binding.expectedArticleId -or
    [string]$matches[0].semantic_evidence -ne
      [string]$binding.semanticEvidence
  ) {
    throw "KNOWN_BINDING_DIMENSION_DRIFT:$($entry.Key)"
  }
  Assert-D10ExactStringSet `
    -Actual @(Get-D10RejectedArticleIds -FixtureRow $matches[0]) `
    -Expected @($binding.rejectedArticleIds) `
    -FailureCode "KNOWN_BINDING_REJECTED_SET_DRIFT:$($entry.Key)"
}

if (($fixtureRows.Count - $knownBindings.Count) -ne 73) {
  throw 'REVIEWED_BINDING_COUNT_VIOLATION'
}

$SecretKey = Get-D10WorkerSecret `
  -ExplicitSecretKey $SecretKey `
  -EncryptedSecretPath $SecretPath
if ($SecretKey -notmatch '^sb_secret_[A-Za-z0-9_-]+$') {
  $SecretKey = $null
  throw 'D10 worker preflight requires the encrypted modern sb_secret_ key.'
}

$headers = @{
  apikey = $SecretKey
}
$results = @()

try {
  New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

  for ($batchStart = 0; $batchStart -lt $ExpectedRows; $batchStart += $BatchSize) {
    $batchNumber = [int]($batchStart / $BatchSize) + 1
    $batchRows = @(
      $fixtureRows | Select-Object -Skip $batchStart -First $BatchSize
    )
    $lexemeIds = @($batchRows | ForEach-Object { [string]$_.lexeme_id })

    Write-Host "Batch $batchNumber/3: $($lexemeIds.Count) bindings"
    $response = Invoke-D10WorkerBatch `
      -LexemeIds $lexemeIds `
      -Headers $headers

    if (
      $response.ok -ne $true -or
      [string]$response.worker -ne 'forms-enrichment-v2-worker' -or
      [string]$response.mode -ne 'shadow' -or
      [int]$response.processed -ne $BatchSize -or
      [int]$response.failed -ne 0 -or
      @($response.missingLexemeIds).Count -ne 0
    ) {
      throw "WORKER_BATCH_CONTRACT_VIOLATION:$batchNumber"
    }
    Assert-D10ExactStringSet `
      -Actual @($response.dictionaries) `
      -Expected @('bm') `
      -FailureCode "WORKER_DICTIONARY_SCOPE_VIOLATION:$batchNumber"

    $workerResults = @($response.results)
    if ($workerResults.Count -ne $BatchSize) {
      throw "WORKER_RESULT_COUNT_VIOLATION:$batchNumber"
    }

    foreach ($candidate in $batchRows) {
      $matches = @(
        $workerResults |
          Where-Object {
            [string]$_.lexemeId -ieq [string]$candidate.lexeme_id
          }
      )
      if ($matches.Count -ne 1) {
        throw "WORKER_RESULT_CARDINALITY_VIOLATION:$($candidate.lexeme_id)"
      }

      $result = $matches[0]
      if (
        [string]$result.lemma -ne [string]$candidate.lemma -or
        [string]$result.pos -ne [string]$candidate.pos
      ) {
        throw "WORKER_IDENTITY_DRIFT:$($candidate.lexeme_id)"
      }
      if ([string]$result.status -ne $ExpectedStatus) {
        throw "WORKER_STATUS_VIOLATION:$($candidate.lexeme_id):$($result.status)"
      }
      if ($result.persisted -ne $false) {
        throw "PERSISTENCE_VIOLATION:$($candidate.lexeme_id)"
      }

      $expectedArticleIds = @([string]$candidate.expected_article_id)
      Assert-D10ExactStringSet `
        -Actual @($result.articleIds) `
        -Expected $expectedArticleIds `
        -FailureCode "ARTICLE_BINDING_DRIFT:$($candidate.lexeme_id)"
      Assert-D10ExactStringSet `
        -Actual @($result.articleProjection.articleIds) `
        -Expected $expectedArticleIds `
        -FailureCode "ARTICLE_PROJECTION_DRIFT:$($candidate.lexeme_id)"

      if (
        [string]$result.articleProjection.status -ne
          $ExpectedProjectionStatus -or
        $result.articleProjection.publishable -ne $true -or
        [string]$result.articleProjection.bindingProviderVersion -ne
          $ExpectedProvider
      ) {
        throw "ARTICLE_PROJECTION_CONTRACT_VIOLATION:$($candidate.lexeme_id)"
      }

      $expectedEvidenceIds = @(
        "ordbokene:bm:$($candidate.expected_article_id)",
        "manual:lexeme-semantic-binding:$($candidate.semantic_evidence)"
      )
      Assert-D10ExactStringSet `
        -Actual @($result.articleProjection.bindingEvidenceIds) `
        -Expected $expectedEvidenceIds `
        -FailureCode "BINDING_EVIDENCE_DRIFT:$($candidate.lexeme_id)"

      $rejectedIds = @(Get-D10RejectedArticleIds -FixtureRow $candidate)
      $returnedArticleIds = @(
        ConvertTo-D10StringSet -Value @(
          $result.articleIds
          $result.articleProjection.articleIds
        )
      )
      if (@($rejectedIds | Where-Object { $returnedArticleIds -contains $_ }).Count -gt 0) {
        throw "REJECTED_HOMOGRAPH_ACTIVATED:$($candidate.lexeme_id)"
      }

      $results += [pscustomobject][ordered]@{
        batch = $batchNumber
        rollout_order = [int]$candidate.rollout_order
        lexeme_id = [string]$candidate.lexeme_id
        lemma = [string]$candidate.lemma
        pos = [string]$candidate.pos
        status = [string]$result.status
        article_id = [string]$candidate.expected_article_id
        rejected_article_ids = $rejectedIds -join '|'
        article_projection_status = [string]$result.articleProjection.status
        provider_version = [string]$result.articleProjection.bindingProviderVersion
        persisted = [bool]$result.persisted
        checked_at = [DateTime]::UtcNow.ToString('o')
      }
    }

    Write-Host "  PASS: batch $batchNumber is 25/25 binding-aware and read-only"
    if ($batchNumber -lt 3 -and $DelayMilliseconds -gt 0) {
      Start-Sleep -Milliseconds $DelayMilliseconds
    }
  }

  if ($results.Count -ne $ExpectedRows) {
    throw "FINAL_RESULT_COUNT_VIOLATION:$($results.Count)"
  }

  $resultsCsvPath = Join-Path $OutputDirectory 'results.csv'
  $summaryJsonPath = Join-Path $OutputDirectory 'summary.json'
  $results |
    Sort-Object -Property rollout_order |
    Export-Csv -LiteralPath $resultsCsvPath -NoTypeInformation -Encoding UTF8

  $summary = [ordered]@{
    generatedAt = [DateTime]::UtcNow.ToString('o')
    ok = $true
    worker = 'forms-enrichment-v2-worker'
    mode = 'shadow'
    sourceOnly = $true
    persisted = $false
    fixtureRows = $fixtureRows.Count
    batches = 3
    resolvedBoundSourceArticle = @(
      $results | Where-Object { $_.status -eq $ExpectedStatus }
    ).Count
    exactArticleMatches = $results.Count
    rejectedHomographHits = 0
    persistenceViolations = 0
    errors = 0
    resultsCsv = $resultsCsvPath
  }
  $summary | ConvertTo-Json -Depth 6 |
    Set-Content -LiteralPath $summaryJsonPath -Encoding UTF8

  Write-Host 'D10 binding-aware preflight PASS'
  $summary | ConvertTo-Json -Depth 6
  Write-Host "Results: $resultsCsvPath"
  Write-Host "Summary: $summaryJsonPath"
}
finally {
  if ($headers) {
    $headers.Clear()
  }
  $headers = $null
  $SecretKey = $null
}
