param(
    [string]$ProjectRoot = (Get-Location).Path,
    [string]$Member,
    [string]$UsedCredits,
    [string]$Activity,
    [string]$Optimization
)
$ErrorActionPreference = 'Stop'
$culture = [Globalization.CultureInfo]::InvariantCulture
function Format-Number([decimal]$Value) { $Value.ToString('0.############################', $culture) }
function Cell([string]$Value) { ($Value -replace '\|', '&#124;' -replace '[\r\n]+', ' ').Trim() }
$root = [IO.Path]::GetFullPath($ProjectRoot)
if (-not $PSBoundParameters.ContainsKey('ProjectRoot')) {
    while (-not (Test-Path -LiteralPath (Join-Path $root 'docs/token-log.md'))) {
        $parent = [IO.Directory]::GetParent($root)
        if ($null -eq $parent) { break }
        $root = $parent.FullName
    }
}
$logPath = Join-Path $root 'docs/token-log.md'
$csvPath = Join-Path $root 'docs/aic-spend.csv'
if (-not (Test-Path -LiteralPath $logPath)) { throw 'Run folder setup first, or specify -ProjectRoot.' }
# Do not silently reinterpret historical balance snapshots as individual expenses.
$legacyPath = Join-Path $root 'docs/aic-balances.csv'
if ((Test-Path -LiteralPath $legacyPath) -and @(Import-Csv -LiteralPath $legacyPath).Count -gt 0) {
    throw 'Historical balance data exists in docs/aic-balances.csv. Convert/reconcile it before using spend logging; no files changed.'
}
$rows = @()
if (Test-Path -LiteralPath $csvPath) { $rows = @(Import-Csv -LiteralPath $csvPath) }
$defaultMember = if ($rows.Count) { $rows[-1].Member } else { $env:USERNAME }
if ([string]::IsNullOrWhiteSpace($Member)) {
    $Member = Read-Host "Member [$defaultMember]"
    if ([string]::IsNullOrWhiteSpace($Member)) { $Member = $defaultMember }
}
$Member = $Member.Trim()
if ([string]::IsNullOrWhiteSpace($Member) -or $Member -match '[\r\n]') { throw 'Enter a valid member name. No files changed.' }
if ([string]::IsNullOrWhiteSpace($Activity)) {
    $Activity = Read-Host 'Activity (what did you do?)'
}
if ([string]::IsNullOrWhiteSpace($Activity)) { throw 'Activity is required. No files changed.' }
$Activity = $Activity.Trim()
$alreadySpent = [decimal]0
foreach ($row in $rows) {
    if ($row.Member -eq $Member) { $alreadySpent += [decimal]::Parse($row.Spent, $culture) }
}
Write-Output "Previous total used for ${Member}: $(Format-Number $alreadySpent) / 4000"
if ([string]::IsNullOrWhiteSpace($UsedCredits)) { $UsedCredits = Read-Host 'Current TOTAL credits USED shown in UI (example: 12.5)' }
if ($UsedCredits.Trim() -notmatch '^\d+(?:[.,]\d+)?$') { throw 'Enter total used as a number, e.g. 12.5 or 12,5. No files changed.' }
$currentUsed = [decimal]::Parse($UsedCredits.Trim().Replace(',', '.'), $culture)
if ($currentUsed -gt 4000) { throw 'Used credits exceed the 4000-credit allowance. No files changed.' }
if ($currentUsed -lt $alreadySpent) { throw 'Total used decreased. Check input/account or reconcile an allowance reset before continuing. No files changed.' }
$amount = $currentUsed - $alreadySpent
if ($amount -eq 0) { Write-Output 'No change in total used; no new record added.'; return }
# Preserve old per-activity expenses; derive their cumulative reading once per member.
$cumulative = @{}
$rows = @($rows | ForEach-Object {
    if (-not $cumulative.ContainsKey($_.Member)) { $cumulative[$_.Member] = [decimal]0 }
    $cumulative[$_.Member] += [decimal]::Parse($_.Spent, $culture)
    [pscustomobject]@{
        Timestamp = $_.Timestamp; Member = $_.Member; Activity = $_.Activity
        Spent = $_.Spent; UsedCredits = (Format-Number $cumulative[$_.Member]); Optimization = $_.Optimization
    }
})
if (-not $PSBoundParameters.ContainsKey('Optimization')) {
    $Optimization = Read-Host 'Optimization applied (optional; Enter to skip)'
}
$now = [DateTimeOffset]::Now
$entry = [pscustomobject]@{
    Timestamp = $now.ToString('o'); Member = $Member; Activity = $Activity
    Spent = (Format-Number $amount); UsedCredits = (Format-Number $currentUsed); Optimization = $Optimization
}
$log = [IO.File]::ReadAllText($logPath)
# Support the workshop's end markers; add explicit start markers for safe updates.
if ($log -notmatch '<!-- records:end -->') {
    $log = "## Token Log`n`n<!-- records:start -->`n| Time | Member | Activity | Credits spent | Optimization applied |`n|------|--------|----------|--------------:|----------------------|`n<!-- records:end -->`n`n" + $log
}
if ([regex]::Matches($log, '<!-- records:end -->').Count -ne 1) { throw 'Expected exactly one records:end marker. No files changed.' }
$recordLine = '| ' + (($now.ToString('yyyy-MM-dd HH:mm'), (Cell $Member), (Cell $Activity), (Format-Number $amount), (Cell $Optimization)) -join ' | ') + ' |'
$log = $log.Replace('<!-- records:end -->', "$recordLine`n<!-- records:end -->")
$rows += $entry
$summary = [Collections.Generic.List[string]]::new()
$summary.Add('<!-- aic:start -->')
$summary.Add('| Team member | AIC before | AIC after (remaining) | Delta (spent) |')
$summary.Add('|-------------|:----------:|:---------------------:|:-------------:|')
$total = [decimal]0
foreach ($group in ($rows | Group-Object Member | Sort-Object Name)) {
    $sum = [decimal]0
    foreach ($row in $group.Group) { $sum += [decimal]::Parse($row.Spent, $culture) }
    $total += $sum
    $summary.Add("| $(Cell $group.Group[0].Member) | 4000 | $(Format-Number (4000 - $sum)) | $(Format-Number $sum) |")
}
$summary.Add('<!-- aic:end -->')
$summaryBlock = $summary -join "`n"
if ($log -match '<!-- aic-summary:start -->') {
    $summaryPattern = '(?s)<!-- aic-summary:start -->.*?<!-- aic-summary:end -->'
} elseif ($log -match '<!-- aic:end -->') {
    if ($log -notmatch '<!-- aic:start -->') {
        $log = [regex]::Replace($log, '(?m)^\|\s*Team member\s*\|', '<!-- aic:start -->' + "`n" + '$0')
    }
    $summaryPattern = '(?s)<!-- aic:start -->.*?<!-- aic:end -->'
} else {
    $log += "`n### AIC balance tracking`n`n<!-- aic:start -->`n<!-- aic:end -->`n"
    $summaryPattern = '(?s)<!-- aic:start -->.*?<!-- aic:end -->'
}
if ([regex]::Matches($log, $summaryPattern).Count -ne 1) { throw 'Expected one AIC summary block. No files changed.' }
$log = [regex]::Replace($log, $summaryPattern, [Text.RegularExpressions.MatchEvaluator]{ param($m) $summaryBlock })
$totalLine = '**Total AIC consumed:** ' + (Format-Number $total)
if ($log -match '<!-- aic:total -->') {
    $totalPattern = '(?m)^\*\*Total AIC consumed:\*\*[^\r\n]*'
    if ([regex]::Matches($log, $totalPattern).Count -ne 1) { throw 'Expected one Total AIC consumed line. No files changed.' }
    $log = [regex]::Replace($log, $totalPattern, $totalLine)
} else { $log += "`n$totalLine`n<!-- aic:total -->`n" }
$rows | Export-Csv -LiteralPath $csvPath -NoTypeInformation -Encoding utf8
[IO.File]::WriteAllText($logPath, $log, [Text.UTF8Encoding]::new($false))
Write-Output "Recorded: $Member total used $(Format-Number $currentUsed); new spend $(Format-Number $amount); remaining $(Format-Number (4000 - $currentUsed))."
Write-Output ($summaryBlock + "`n" + $totalLine)
Write-Output "Saved to $logPath (detail data: docs/aic-spend.csv)."
