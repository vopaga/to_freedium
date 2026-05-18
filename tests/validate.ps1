$ErrorActionPreference = "Stop"

$articleRegex = '^(https?)://((?:[a-z0-9-]+\.)*medium\.com)/([^?#]*?)([0-9a-f]{12})(?:[?#].*)?$'
$testCases = @(
  @{ Url = 'https://medium.com/@user/title-1234567890ab'; ExpectedId = '1234567890ab'; ExpectedHost = 'medium.com'; ExpectedPrefix = '@user/title-' },
  @{ Url = 'https://towardsdatascience.com/some-article-abcdef123456'; ExpectedId = 'abcdef123456'; ExpectedHost = 'towardsdatascience.com'; ExpectedPrefix = 'some-article-'; Regex = '^(https?)://(towardsdatascience\.com)/([^?#]*?)([0-9a-f]{12})(?:[?#].*)?$' },
  @{ Url = 'https://medium.com/p/1234567890ab'; ExpectedId = '1234567890ab'; ExpectedHost = 'medium.com'; ExpectedPrefix = 'p/' }
)

foreach ($case in $testCases) {
  $regex = if ($case.ContainsKey('Regex')) { $case.Regex } else { $articleRegex }
  if ($case.Url -notmatch $regex) {
    throw "Regex did not match: $($case.Url)"
  }
  if ($Matches[4] -ne $case.ExpectedId) {
    throw "Expected article id '$($case.ExpectedId)' but got '$($Matches[4])' for $($case.Url)"
  }
  if ($Matches[2] -ne $case.ExpectedHost) {
    throw "Expected host '$($case.ExpectedHost)' but got '$($Matches[2])' for $($case.Url)"
  }
  if ($Matches[3] -ne $case.ExpectedPrefix) {
    throw "Expected prefix '$($case.ExpectedPrefix)' but got '$($Matches[3])' for $($case.Url)"
  }
}

$templateCases = @(
  @{ Template = 'https://freedium-mirror.cfd/'; Id = '1234567890ab'; Url = 'https://medium.com/p/1234567890ab'; Expected = 'https://freedium-mirror.cfd/1234567890ab' },
  @{ Template = 'https://mirror.example/{id}'; Id = '1234567890ab'; Url = 'https://medium.com/p/1234567890ab'; Expected = 'https://mirror.example/1234567890ab' },
  @{ Template = 'https://mirror.example/read?url={url}'; Id = '1234567890ab'; Url = 'https://medium.com/p/1234567890ab'; Expected = 'https://mirror.example/read?url=https%3A%2F%2Fmedium.com%2Fp%2F1234567890ab' }
)

$invalidTemplateCases = @(
  'https://mirror.example/{invalid}',
  'https://mirror.example/{id}/{url}/{extra}'
)

$blockedMirrorUrls = @(
  'https://medium.com/',
  'https://sub.medium.com/',
  'https://towardsdatascience.com/read?url={url}',
  'https://levelup.gitconnected.com/{id}'
)

$manifest = Get-Content -Raw c:\projects\to_freedium\manifest.json | ConvertFrom-Json
$publicationData = Get-Content -Raw c:\projects\to_freedium\data\publications.json | ConvertFrom-Json

$expectedOptionalOrigins = $publicationData | ForEach-Object { "*://$($_.host)/*" }
$expectedWerOrigins = @('*://medium.com/*', '*://*.medium.com/*') + $expectedOptionalOrigins
$expectedWerResources = @('mirror-template.js', 'redirect.html', 'redirect.js')

if ((@($manifest.optional_host_permissions) -join "`n") -ne ($expectedOptionalOrigins -join "`n")) {
  throw 'optional_host_permissions is out of sync with data/publications.json'
}

$werOrigins = @($manifest.web_accessible_resources[0].matches)
if ((@($werOrigins) -join "`n") -ne ($expectedWerOrigins -join "`n")) {
  throw 'web_accessible_resources matches are out of sync with supported domains'
}

$werResources = @($manifest.web_accessible_resources[0].resources)
if ((@($werResources) -join "`n") -ne ($expectedWerResources -join "`n")) {
  throw 'web_accessible_resources resources are out of sync with redirect bridge assets'
}

foreach ($case in $templateCases) {
  if ($case.Template.Contains('{id}') -or $case.Template.Contains('{url}')) {
    $result = $case.Template.Replace('{id}', $case.Id).Replace('{url}', [System.Uri]::EscapeDataString($case.Url))
  }
  else {
    $result = "$($case.Template)$($case.Id)"
  }
  if ($result -ne $case.Expected) {
    throw "Template expansion failed. Expected '$($case.Expected)' but got '$result'"
  }
}

foreach ($template in $invalidTemplateCases) {
  if ($template -match '\{(?!id\}|url\})[^}]*\}') {
    continue
  }
  throw "Invalid template validation regex did not reject '$template'"
}

$managedMirrorHosts = @('medium.com') + ($publicationData | ForEach-Object { $_.host })
foreach ($mirrorUrl in $blockedMirrorUrls) {
  $mirrorHost = ([System.Uri]$mirrorUrl.Replace('{id}', 'example-id').Replace('{url}', 'https%3A%2F%2Fmedium.com%2Fexample-id')).Host.ToLowerInvariant()
  $matchesManagedSource = $false
  foreach ($managedHost in $managedMirrorHosts) {
    if ($mirrorHost -eq $managedHost -or $mirrorHost.EndsWith(".$managedHost")) {
      $matchesManagedSource = $true
      break
    }
  }
  if (-not $matchesManagedSource) {
    throw "Blocked mirror URL validation did not reject '$mirrorUrl'"
  }
}

Write-Host 'Validation passed.'