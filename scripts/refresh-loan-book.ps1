<#
  Refresh the Muthi loan-book workbook from the live database and file it to
  Projects\Muthi-Docs\04-Loan-Book (which sits outside this git repo). Run this
  after any change to the loan data so the Excel is always current and ready —
  it does not need to be sent anywhere, just kept up to date for when it is asked for.

  Steps:
    1. Export the whole loan book from Postgres to JSON (scripts/export-loan-book.mjs).
    2. Build the formula-driven workbook (scripts/build-loan-book-xlsx.py), As-of = today
       unless -AsOf is given.
    3. Open it in Excel, recalc so the values are baked (otherwise a viewer that does not
       recalculate shows blanks), save, and export a PDF snapshot. If Excel is unavailable
       this step is skipped and the formula-only .xlsx is filed anyway — Excel will
       compute it on open.
    4. Copy "Muthi Loan Book <AsOf>.xlsx" (and the .pdf) into Muthi-Docs\04-Loan-Book.

  Usage:  pwsh scripts/refresh-loan-book.ps1 [-AsOf yyyy-MM-dd]
#>
param(
  [string]$AsOf = (Get-Date -Format 'yyyy-MM-dd')
)
$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
$docs = Join-Path (Split-Path -Parent $repo) 'Muthi-Docs\04-Loan-Book'
if (-not (Test-Path $docs)) { throw "destination not found: $docs" }

$tmpJson = Join-Path $env:TEMP 'muthi-loan-book.json'
$tmpXlsx = Join-Path $env:TEMP ("Muthi Loan Book $AsOf.xlsx")
$tmpPdf  = [System.IO.Path]::ChangeExtension($tmpXlsx, '.pdf')
if (Test-Path $tmpPdf) { Remove-Item $tmpPdf -Force }

Push-Location $repo
try {
  # 1. Export live data.
  node scripts/export-loan-book.mjs $tmpJson
  if ($LASTEXITCODE -ne 0) { throw 'export-loan-book.mjs failed' }

  # 2. Build the workbook (formulas keyed off the As-of cell).
  python scripts/build-loan-book-xlsx.py $tmpJson $tmpXlsx $AsOf
  if ($LASTEXITCODE -ne 0) { throw 'build-loan-book-xlsx.py failed' }
} finally {
  Pop-Location
}

# 3. Recalc + bake values + PDF via Excel COM (non-fatal if Excel is missing).
$baked = $false
try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  try {
    $wb = $excel.Workbooks.Open($tmpXlsx)
    $excel.CalculateFullRebuild()
    $wb.Save()
    try { $wb.ExportAsFixedFormat(0, $tmpPdf) } catch { Write-Host "  (PDF export skipped: $($_.Exception.Message))" }
    $wb.Close($false)
    $baked = $true
  } finally {
    $excel.Quit()
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
    [GC]::Collect(); [GC]::WaitForPendingFinalizers()
  }
} catch {
  Write-Host "  (Excel recalc skipped: $($_.Exception.Message) - the .xlsx will compute on open)"
}

# 4. File into Muthi-Docs.
Copy-Item $tmpXlsx (Join-Path $docs "Muthi Loan Book $AsOf.xlsx") -Force
if (Test-Path $tmpPdf) { Copy-Item $tmpPdf (Join-Path $docs "Muthi Loan Book $AsOf.pdf") -Force }

$valueState = if ($baked) { 'baked' } else { 'formula-only' }
Write-Host ("Loan book refreshed for {0} (values {1}) -> {2}" -f $AsOf, $valueState, $docs)
