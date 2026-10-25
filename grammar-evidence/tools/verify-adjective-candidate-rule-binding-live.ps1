param([string]$OutputPath)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$envPath = Join-Path $root '.env.local'
$credentials = @{}
Get-Content -LiteralPath $envPath | ForEach-Object {
  if ($_ -match '^(EXPO_PUBLIC_SUPABASE_URL|SUPABASE_SECRET_KEY)=(.*)$') {
    $credentials[$matches[1]] = $matches[2].Trim('"').Trim("'")
  }
}
if (-not $credentials['EXPO_PUBLIC_SUPABASE_URL'] -or -not $credentials['SUPABASE_SECRET_KEY']) {
  throw 'internal_shadow_credentials_missing'
}

$lexemeId = '81a6cba3-26d1-4bf1-9cb3-41997911dd50'
$snapshotId = '965f0a1a-9f22-446a-b36c-f573c9a002d8'
$ruleCode = 'nrg_rt_v1.adjective.degree.suffix.el_en_er_vowel_deletion.comparative'
$manifestCode = 'shadow.adjective.degree.apen.en_deletion.v1'
$sourceCandidateId = '8cd6ed7e-c27d-4283-bcf1-58af141f387c'
$expectedCandidateId = "surface:${lexemeId}:adjective"
$headers = @{ apikey = $credentials['SUPABASE_SECRET_KEY'] }
$base = $credentials['EXPO_PUBLIC_SUPABASE_URL'].TrimEnd('/')

$graphResponse = Invoke-RestMethod -Method Post -Uri "$base/functions/v1/canonical-graph-shadow-v1" `
  -Headers $headers -ContentType 'application/json' -Body '{"text":"En åpen bok."}'
$ruleResponse = Invoke-RestMethod -Method Post -Uri "$base/functions/v1/adjective-degree-sql-shadow-v1" `
  -Headers $headers -ContentType 'application/json' -Body ("{""lexemeId"":""$lexemeId""}")

function Test-Binding($graph, $rule, [string]$candidateId, [string]$snapshot) {
  if ($graph.ok -ne $true -or $graph.grammar_activation -ne $false -or
      $graph.invariants.errors.Count -gt 0) { return 'graph_invalid' }
  if (@($graph.sentence_runs).Count -ne 1 -or $graph.sentence_runs[0].sentenceEvidence.resolved -ne 0) {
    return 'sentence_resolution_not_candidate_only'
  }
  $findings = @($graph.sentence_runs[0].sentenceEvidence.findings | Where-Object {
    $_.status -eq 'context_supported' -and $_.candidateId -eq $candidateId
  })
  if ($findings.Count -ne 1 -or $candidateId -ne $expectedCandidateId) {
    return 'source_candidate_identity_mismatch'
  }
  $finding = $findings[0]
  $surface = @($graph.surface.tokens | Where-Object { $_.id -eq $finding.tokenId })
  if ($surface.Count -ne 1 -or $surface[0].surface -ne 'åpen') { return 'canonical_token_mismatch' }
  $readings = @($graph.language_graph.nodes | Where-Object {
    $_.type -eq 'lexical_reading' -and $_.producer -eq 'canonical_candidate_lattice_v1' -and
    $_.features.lexemeId -eq $lexemeId -and $_.features.sourcePos -eq 'adjective' -and
    @($_.span.tokenIds).Contains($finding.tokenId)
  })
  if ($readings.Count -ne 1 -or $readings[0].status -ne 'candidate') {
    return 'canonical_reading_identity_mismatch'
  }
  if ($rule.ok -ne $true -or $rule.status -ne 'candidate' -or
      $rule.activationAuthority -ne $false -or $rule.graphMutation -ne $false -or
      $rule.lexemeId -ne $lexemeId -or $rule.positiveForm -ne $surface[0].surface -or
      $rule.ruleCode -ne $ruleCode -or $rule.manifestCode -ne $manifestCode -or
      $rule.sourceCandidateId -ne $sourceCandidateId -or
      $rule.positiveSnapshotId -ne $snapshotId -or $snapshot -ne $snapshotId -or
      [string]$rule.articleId -ne '1033' -or -not $rule.candidate) {
    return 'rule_or_snapshot_mismatch'
  }
  return 'candidate_derivation_observed'
}

$positive = Test-Binding $graphResponse $ruleResponse $expectedCandidateId $snapshotId
$wrongCandidate = Test-Binding $graphResponse $ruleResponse 'surface:wrong:adjective' $snapshotId
$alteredRuleResponse = $ruleResponse | ConvertTo-Json -Depth 12 | ConvertFrom-Json
$alteredRuleResponse.positiveSnapshotId = '00000000-0000-0000-0000-000000000000'
$wrongSnapshot = Test-Binding $graphResponse $alteredRuleResponse $expectedCandidateId $snapshotId
$bokReadings = @($graphResponse.language_graph.nodes | Where-Object {
  $_.type -eq 'lexical_reading' -and $_.features.sourcePos -eq 'noun' -and
  @($_.span.tokenIds).Contains('tok:2:8:11')
} | ForEach-Object { $_.features.lexemeId } | Sort-Object -Unique)
$expectedBok = @('ec9da2b9-22d4-4292-81e3-05b26f4aa852',
  'ff26110c-7180-4ef4-92e9-372355e40a90') | Sort-Object
if ($positive -ne 'candidate_derivation_observed' -or
    $wrongCandidate -ne 'source_candidate_identity_mismatch' -or
    $wrongSnapshot -ne 'rule_or_snapshot_mismatch' -or
    (Compare-Object $bokReadings $expectedBok).Count -ne 0) {
  throw "candidate_binding_controls_failed positive=$positive wrongCandidate=$wrongCandidate wrongSnapshot=$wrongSnapshot bokCount=$($bokReadings.Count)"
}

$result = [ordered]@{
  schema_version = 'grammar-evidence-live-candidate-binding-v1'
  observed_at_utc = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
  project_id = 'kevpkawrbtovrgyjkkvu'
  input_text = 'En åpen bok.'
  graph_route = 'canonical-graph-shadow-v1'
  rule_route = 'adjective-degree-sql-shadow-v1'
  canonical_token_id = $graphResponse.sentence_runs[0].sentenceEvidence.findings[0].tokenId
  source_candidate_id = $expectedCandidateId
  lexeme_id = $lexemeId
  positive_snapshot_id = $snapshotId
  rule_code = $ruleCode
  derived_form = $ruleResponse.candidate
  observed_status = $positive
  wrong_candidate_control = $wrongCandidate
  wrong_snapshot_control = $wrongSnapshot
  retained_bok_lexeme_ids = $bokReadings
  graph_candidate_status = 'candidate'
  output_class = 'rule_derivation_evidence_for_candidate_only'
  persistence_authority = $false
  activation_authority = $false
  consumer_boundary = 'analyze-text owns card verification, enrichment and any database persistence'
  limits = @(
    'The two Production responses were joined by this read-only verifier; the canonical graph runtime does not yet invoke the SQL rule endpoint.',
    'The canonical lexical node carries lexeme ID and POS but does not carry the raw SQL source candidate ID as a separate feature.',
    'The derived form is a rule output candidate; this check does not establish sentence-level POS, learner-facing correctness or a verified card.'
  )
  conclusion = 'Two trusted Production shadow responses can be joined for this exact token and lexeme without dropping either bok reading. This is a read-only observation, not an integrated graph executor or a verified analyze-text card.'
}
$json = ($result | ConvertTo-Json -Depth 8).Replace("`r`n", "`n")
if ($OutputPath) {
  $resolvedOutput = [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $OutputPath))
  [System.IO.File]::WriteAllText($resolvedOutput, "$json`n", [System.Text.UTF8Encoding]::new($false))
}
Write-Output $json
