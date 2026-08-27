# Get-SprakradetGrammatikk.ps1
# =========================================
# Fetches grammar-rule article text from Sprakradet.no.
#
# IMPORTANT / HONEST NOTE:
# Sprakradet.no has NO public API. This script scrapes the public HTML pages
# under /godt-og-korrekt-sprak/rettskriving-og-grammatikk/. Extraction relies on
# text landmarks verified manually on a handful of pages (title heading,
# "Fant du det du lette etter?" feedback block, "Besøksadresse" footer marker).
# If Sprakradet changes their site layout, this WILL break silently or return
# garbage — always sanity-check output before trusting it, don't assume "ran
# without error" means "content is correct".

[CmdletBinding(DefaultParameterSetName = 'List')]
param (
    [Parameter(Mandatory = $true, ParameterSetName = 'ByTopic')]
    [ValidateSet(
        'kommaregler','tall-tid-dato','stor-eller-liten-forbokstav','eitt-eller-fleire-ord',
        'lovhenvisninger','forkortelser','orddeling-ved-linjeskift','a-eller-og','da-eller-nar',
        'de-eller-dem','adjektiver-og-partisipper','grammatiske-termar','mellomrom','punktlister',
        'imperativ','s-verb','bindebokstaver-i-sammensatte-ord','preposisjonsbruk',
        'tegn/aksentteikn','tegn/apostrof','tegn/bindestrek','tegn/hermeteikn','tegn/kolon',
        'tegn/punktum','tegn/semikolon','tegn/skrastrek','tegn/tankestrek'
    )]
    [string]$Topic,

    [Parameter(Mandatory = $true, ParameterSetName = 'ByUrl')]
    [string]$Url,

    [Parameter(ParameterSetName = 'List')]
    [switch]$ListTopics,

    [Parameter(Mandatory = $true, ParameterSetName = 'FromFile')]
    [string]$TopicsFile,

    [Parameter(ParameterSetName = 'FromFile')]
    [string]$OutFile
)

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
} catch {
    Write-Host "Could not force TLS 1.2 - continuing with default: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Same set as the ValidateSet above, kept in sync manually — used to sanity-check
# lines coming from an external file (typos, stray blank lines, wrong slugs).
$KnownTopics = @(
    'kommaregler','tall-tid-dato','stor-eller-liten-forbokstav','eitt-eller-fleire-ord',
    'lovhenvisninger','forkortelser','orddeling-ved-linjeskift','a-eller-og','da-eller-nar',
    'de-eller-dem','adjektiver-og-partisipper','grammatiske-termar','mellomrom','punktlister',
    'imperativ','s-verb','bindebokstaver-i-sammensatte-ord','preposisjonsbruk',
    'tegn/aksentteikn','tegn/apostrof','tegn/bindestrek','tegn/hermeteikn','tegn/kolon',
    'tegn/punktum','tegn/semikolon','tegn/skrastrek','tegn/tankestrek'
)

$BaseUrl = "https://sprakradet.no/godt-og-korrekt-sprak/rettskriving-og-grammatikk/"

# Known boilerplate nav-menu lines that appear identically on every page.
# Filtered out so they don't pollute the extracted article text.
$NavBoilerplate = @(
    'Hjem', 'Meny', 'Lukk', 'Søk',
    'Språkloven. Språklige plikter og rettigheter',
    'Korrekt språk. Ordbøker',
    'Klarspråk',
    'Nettkurs og undervisning',
    'Nyord og rettskrivings­endringer',
    'Fagspråk, terminologi- og begrepsarbeid',
    'Stedsnavn og navn på statsorgan',
    'Språkteknologi og KI',
    'Aktuelt',
    'Om Språkrådet',
    'Rettskriving og grammatikk',
    'Kontakt',
    'Meld deg på nyhetsbrev',
    'Information in English',
    'Personvern',
    'Informasjonskapsler',
    'Administrer informasjonskapsler',
    'Tilgjengelighet'
)

function Get-SprakradetArticle {
    param([string]$PageUrl)

    $headers = @{
        "User-Agent"      = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
        "Accept"          = "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
        "Accept-Language" = "nb-NO,nb;q=0.9,no;q=0.8,en-US;q=0.7,en;q=0.6"
        "Cache-Control"   = "no-cache"
        "Referer"         = "https://sprakradet.no/godt-og-korrekt-sprak/rettskriving-og-grammatikk/"
    }

    try {
        $response = Invoke-WebRequest -Uri $PageUrl `
            -Method GET `
            -Headers $headers `
            -UseBasicParsing `
            -TimeoutSec 30

        if ($response.StatusCode -ne 200) {
            return [PSCustomObject]@{
                Source  = "Sprakradet"
                Url     = $PageUrl
                Status  = "HTTP $($response.StatusCode)"
                Found   = $false
                Title   = $null
                Content = $null
            }
        }

        $html = $response.Content

        # --- Extract <title> ---
        $title = $null
        if ($html -match '<title>\s*(.*?)\s*</title>') {
            $title = [System.Net.WebUtility]::HtmlDecode($Matches[1]) -replace '\s*-\s*Språkrådet\s*$', ''
        }

        # --- Isolate main content block ---
        # Landmark: skip-link target is #content-section; footer starts near "Besøksadresse".
        # We cut from the <h1> (article heading) up to the "Fant du det du lette etter?" feedback
        # block, which every article page has right before the footer.
        $bodyChunk = $html

        $startMatch = [regex]::Match($bodyChunk, '<h1[^>]*>.*?</h1>', 'Singleline')
        if (-not $startMatch.Success) {
            return [PSCustomObject]@{
                Source  = "Sprakradet"
                Url     = $PageUrl
                Status  = "No <h1> found - page layout may have changed"
                Found   = $false
                Title   = $title
                Content = $null
            }
        }

        $afterH1 = $bodyChunk.Substring($startMatch.Index)

        # End boundary: the feedback widget heading, or fall back to "Besøksadresse" footer marker.
        $endIdx = $afterH1.IndexOf('Fant du det du lette etter', [StringComparison]::OrdinalIgnoreCase)
        if ($endIdx -lt 0) {
            $endIdx = $afterH1.IndexOf('Besøksadresse', [StringComparison]::OrdinalIgnoreCase)
        }
        if ($endIdx -gt 0) {
            $afterH1 = $afterH1.Substring(0, $endIdx)
        }

        # --- Strip tags -> plain text ---
        $text = $afterH1 -replace '<script[^>]*>.*?</script>', '' `
                          -replace '<style[^>]*>.*?</style>', '' `
                          -replace '<[^>]+>', "`n"
        $text = [System.Net.WebUtility]::HtmlDecode($text)

        $lines = $text -split "`n" | ForEach-Object { $_.Trim() } | Where-Object {
            $_ -and ($NavBoilerplate -notcontains $_)
        }

        # Collapse consecutive duplicate lines (common artifact of nested <a> tag text)
        $cleanLines = @()
        foreach ($line in $lines) {
            if ($cleanLines.Count -eq 0 -or $cleanLines[-1] -ne $line) {
                $cleanLines += $line
            }
        }

        $content = ($cleanLines -join "`n").Trim()

        return [PSCustomObject]@{
            Source  = "Sprakradet"
            Url     = $PageUrl
            Status  = if ($content) { "OK" } else { "Empty after extraction - verify manually" }
            Found   = [bool]$content
            Title   = $title
            Content = $content
        }

    } catch {
        return [PSCustomObject]@{
            Source  = "Sprakradet"
            Url     = $PageUrl
            Status  = "Error"
            Found   = $false
            Title   = $null
            Content = $null
            Error   = $_.Exception.Message
        }
    }
}

if ($ListTopics -or $PSCmdlet.ParameterSetName -eq 'List') {
    Write-Host "Known topic slugs (verified against site structure at time of writing):"
    $KnownTopics | ForEach-Object { Write-Host "  $_" }
    return
}

if ($PSCmdlet.ParameterSetName -eq 'FromFile') {
    if (-not (Test-Path -Path $TopicsFile -PathType Leaf)) {
        Write-Host "File not found: $TopicsFile" -ForegroundColor Red
        return
    }

    $lines = Get-Content -Path $TopicsFile | ForEach-Object { $_.Trim() } | Where-Object { $_ -and $_ -notmatch '^\s*#' }

    if (-not $lines) {
        Write-Host "File is empty (or only comments/blank lines): $TopicsFile" -ForegroundColor Yellow
        return
    }

    $results = @()
    foreach ($line in $lines) {
        if ($KnownTopics -notcontains $line) {
            Write-Host "SKIP  '$line' - not a recognized topic slug (typo? check -ListTopics)" -ForegroundColor Yellow
            $results += [PSCustomObject]@{
                Source = "Sprakradet"; Url = $null; Status = "Unknown topic slug"
                Found = $false; Title = $null; Content = $null
            }
            continue
        }
        $topicUrl = "$BaseUrl$line/"
        Write-Host "Fetching '$line' ..." -ForegroundColor Cyan
        $r = Get-SprakradetArticle -PageUrl $topicUrl
        Write-Host "  -> $($r.Status)" -ForegroundColor $(if ($r.Found) { 'Green' } else { 'Yellow' })
        $results += $r
        Start-Sleep -Milliseconds 800
    }

    $json = $results | ConvertTo-Json -Depth 5

    if ($OutFile) {
        $json | Out-File -FilePath $OutFile -Encoding utf8
        Write-Host "----------------------------------------"
        Write-Host "Saved $($results.Count) results to $OutFile"
    } else {
        Write-Host "----------------------------------------"
        $json
    }
    return
}

if ($PSCmdlet.ParameterSetName -eq 'ByTopic') {
    $targetUrl = "$BaseUrl$Topic/"
} else {
    $targetUrl = $Url
}

$result = Get-SprakradetArticle -PageUrl $targetUrl

Write-Host "----------------------------------------"
Write-Host "URL:    $($result.Url)"
Write-Host "Status: $($result.Status)" -ForegroundColor $(if ($result.Found) { 'Green' } else { 'Yellow' })
Write-Host "Title:  $($result.Title)"
Write-Host "----------------------------------------"

$result | ConvertTo-Json -Depth 5
