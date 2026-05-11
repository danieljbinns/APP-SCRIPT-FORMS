##############################################################################
# migrate-from-excel/run.ps1
# Reads prod Excel -> writes data into staging Excel (import to Google Sheets manually)
##############################################################################
$ErrorActionPreference = 'Stop'
Import-Module ImportExcel -ErrorAction Stop

$prodPath = "C:\Users\dbinns_robinsonsolut\Downloads\Employee Managment Forms  (1).xlsx"
$devPath  = "C:\Users\dbinns_robinsonsolut\Downloads\STAGING Employee Management Data.xlsx"

Write-Host "=== Migration started ==="
Write-Host "Prod: $prodPath"
Write-Host "Dev : $devPath"

##############################################################################
# HELPERS
##############################################################################

function New-TaskId { 'TK-' + [guid]::NewGuid().ToString('N').Substring(0,8).ToUpper() }

# Column names that are known timestamps — OA double conversion is safe for these.
# All other doubles are left alone to avoid converting numeric IDs that fall in date range.
$TIMESTAMP_COLS = @('Submission Timestamp','Created Date','Completed Date','Last Updated','Timestamp','Date Requested')

function Format-Dates {
    param($rows)
    $rows | ForEach-Object {
        $row = $_
        foreach ($prop in $row.PSObject.Properties) {
            $val = $prop.Value
            if ($val -is [DateTime]) {
                if ($val.TimeOfDay.TotalSeconds -eq 0) {
                    $prop.Value = $val.ToString('yyyy-MM-dd')
                } else {
                    $prop.Value = $val.ToString('yyyy-MM-dd HH:mm:ss')
                }
            } elseif ($val -is [double] -and $TIMESTAMP_COLS -contains $prop.Name -and $val -gt 40000 -and $val -lt 60000) {
                # 40000 = 2009-07-06, 60000 = 2064-02-20 — safe window for real submission timestamps
                try {
                    $dt = [DateTime]::FromOADate($val)
                    $prop.Value = $dt.ToString('yyyy-MM-dd HH:mm:ss')
                } catch {}
            }
        }
        $row
    }
}

# Add columns missing from source objects so they survive Export-Excel column ordering
function Pad-Objects {
    param($rows, [string[]]$requiredCols)
    $rows | ForEach-Object {
        foreach ($c in $requiredCols) {
            if (-not $_.PSObject.Properties[$c]) {
                $_ | Add-Member -NotePropertyName $c -NotePropertyValue '' -Force
            }
        }
        $_
    }
}

##############################################################################
# STEP 1 -- Copy main sheets
##############################################################################
Write-Host "`n--- Step 1: Copy main sheets ---"

# Workflows -- normalize legacy status values to current canonical format
$wf = Format-Dates (Import-Excel $prodPath -WorksheetName 'Workflows')
$statusMap = @{ 'Complete' = 'Completed'; 'Done' = 'Completed'; 'Closed' = 'Completed'; 'Active' = 'In Progress'; 'Open' = 'Pending' }
$wf | ForEach-Object {
    $s = "$($_.'Status')"
    if ($statusMap.ContainsKey($s)) { $_.'Status' = $statusMap[$s] }
}
Export-Excel -Path $devPath -WorksheetName 'Workflows' -InputObject $wf -ClearSheet -NoNumberConversion *
Write-Host "  Workflows: $($wf.Count) rows"

# Initial Requests -- has duplicate "Prev User" headers (cols 27 & 38); use EPPlus for direct positional copy.
# Prod: cols 1-49 copied 1:1; prod col 50 (Status) -> dev col 53; dev cols 50-52, 54 blank.
$prodPkg = Open-ExcelPackage $prodPath
$devPkg  = [OfficeOpenXml.ExcelPackage]::new([System.IO.FileInfo]$devPath)
$srcIR   = $prodPkg.Workbook.Worksheets['Initial Requests']
$dstIR   = $devPkg.Workbook.Worksheets['Initial Requests']
if ($dstIR.Dimension -and $dstIR.Dimension.Rows -gt 1) { $dstIR.DeleteRow(2, $dstIR.Dimension.Rows - 1) }
function Convert-CellValue {
    param($cell)
    $val = $cell.Value
    if ($val -is [double] -and $val -gt 25569 -and $val -lt 109574) {
        $nf = $cell.Style.Numberformat.Format
        # Only convert if Excel tagged the cell with a date/time number format
        if ($nf -and $nf -ne 'General' -and $nf -match 'yy|dd|hh|mm\/|\/mm') {
            try {
                $dt = [DateTime]::FromOADate($val)
                if ($dt.TimeOfDay.TotalSeconds -eq 0) { return $dt.ToString('yyyy-MM-dd') }
                else { return $dt.ToString('yyyy-MM-dd HH:mm:ss') }
            } catch {}
        }
    }
    return $val
}

$irRowCount = 0
for ($r = 2; $r -le $srcIR.Dimension.Rows; $r++) {
    for ($c = 1; $c -le 49; $c++) { $dstIR.Cells[$r, $c].Value = Convert-CellValue $srcIR.Cells[$r, $c] }
    $dstIR.Cells[$r, 53].Value = Convert-CellValue $srcIR.Cells[$r, 50]  # Status: prod col 50 -> dev col 53
    $irRowCount++
}
$devPkg.Save()
$prodPkg.Dispose(); $devPkg.Dispose()
Write-Host "  Initial Requests: $irRowCount rows (EPPlus positional copy)"

# ID Setup Results -- dev has BOSS WIS Created inserted before Submitted By
$id = Format-Dates (Import-Excel $prodPath -WorksheetName 'ID Setup Results')
$idCols = @('Workflow ID','Form ID','Submission Timestamp','Internal Employee ID',
  'SiteDocs Worker ID','SiteDocs Job Code','SiteDocs Username','SiteDocs Password',
  'DSS Username','DSS Password','Setup Notes','BOSS WIS Created','Submitted By')
$id = Pad-Objects $id $idCols
Export-Excel -Path $devPath -WorksheetName 'ID Setup Results' -InputObject $id -ClearSheet -NoNumberConversion *
Write-Host "  ID Setup Results: $($id.Count) rows"

# HR Verification Results (identical)
$hr = Format-Dates (Import-Excel $prodPath -WorksheetName 'HR Verification Results')
Export-Excel -Path $devPath -WorksheetName 'HR Verification Results' -InputObject $hr -ClearSheet -NoNumberConversion *
Write-Host "  HR Verification Results: $($hr.Count) rows"

# IT Results (identical)
$it = Format-Dates (Import-Excel $prodPath -WorksheetName 'IT Results')
Export-Excel -Path $devPath -WorksheetName 'IT Results' -InputObject $it -ClearSheet -NoNumberConversion *
Write-Host "  IT Results: $($it.Count) rows"

##############################################################################
# STEP 2 -- Migrate legacy specialist sheets -> Action Items
##############################################################################
Write-Host "`n--- Step 2: Migrate specialist sheets -> Action Items ---"

$aiCols = @('Workflow ID','Task ID','Category','Task Name','Description','Assigned To',
            'Status','Created Date','Completed Date','Notes','Closed By','Draft','Form Type','Form Data')
$aiRows = [System.Collections.Generic.List[object]]::new()

$legacyMap = @(
  @{ Sheet='Business Cards Results'; Cat='Business Cards'; FT='businesscards'; Task='Business Cards Order';     To='davelangohr@team-group.com' },
  @{ Sheet='SiteDocs Results';       Cat='SiteDocs';       FT='sitedocs';      Task='SiteDocs / DSS ID Setup'; To='grp.forms.idsetup@team-group.com' },
  @{ Sheet='30-60-90 Review Results';Cat='30-60-90 Review';FT='30_60_90';      Task='30-60-90 Review';         To='grp.forms.review306090@team-group.com' },
  @{ Sheet='Credit Card Results';    Cat='Credit Card';    FT='creditcard';    Task='Credit Card Setup';        To='grp.forms.jonas@team-group.com' },
  @{ Sheet='Fleetio Results';        Cat='Fleetio';        FT='fleetio';       Task='Fleetio Setup';            To='grp.forms.fleetio@team-group.com' },
  @{ Sheet='JONAS Results';          Cat='Jonas';          FT='jonas';         Task='Jonas / Central Purchasing Setup'; To='grp.forms.jonas@team-group.com' }
)

foreach ($m in $legacyMap) {
  try {
    $src = Import-Excel $prodPath -WorksheetName $m.Sheet -ErrorAction Stop
    foreach ($row in $src) {
      $wfId = "$($row.'Workflow ID')"
      if (-not $wfId) { continue }
      $det   = "$($row.'Details')"   -replace '"','\"'
      $notes = "$($row.'Notes')"     -replace '"','\"'
      $subBy = "$($row.'Submitted By')"
      $fmId  = "$($row.'Form ID')"
      $rawTs = $row.'Submission Timestamp'
      $ts    = if ($rawTs -is [DateTime]) { $rawTs.ToString('yyyy-MM-dd HH:mm:ss') } elseif ($rawTs -is [double] -and $rawTs -gt 25569) { [DateTime]::FromOADate($rawTs).ToString('yyyy-MM-dd HH:mm:ss') } else { "$rawTs" }
      $aiRows.Add([PSCustomObject]@{
        'Workflow ID'    = $wfId
        'Task ID'        = (New-TaskId)
        'Category'       = $m.Cat
        'Task Name'      = $m.Task
        'Description'    = '["Migrated from legacy ' + $m.Sheet + '"]'
        'Assigned To'    = $m.To
        'Status'         = 'Closed'
        'Created Date'   = $ts
        'Completed Date' = $ts
        'Notes'          = $notes
        'Closed By'      = $subBy
        'Draft'          = ''
        'Form Type'      = $m.FT
        'Form Data'      = "{`"formId`":`"$fmId`",`"details`":`"$det`",`"notes`":`"$notes`",`"submittedBy`":`"$subBy`",`"migratedFrom`":`"$($m.Sheet)`"}"
      })
    }
    Write-Host "  $($m.Sheet): $($src.Count) rows migrated"
  } catch { Write-Host "  [SKIP] $($m.Sheet): $_" }
}

# Write Action Items
$aiPadded = Pad-Objects $aiRows $aiCols
Export-Excel -Path $devPath -WorksheetName 'Action Items' -InputObject $aiPadded -ClearSheet -NoNumberConversion *
Write-Host "  Action Items total: $($aiRows.Count)"

##############################################################################
# STEP 3 -- Build Dashboard_View from Workflows + Initial Requests
##############################################################################
Write-Host "`n--- Step 3: Build Dashboard_View ---"

$wfData = $wf  # reuse already-normalized Workflows data from Step 1

# Initial Requests has duplicate "Prev User" headers — read positionally via EPPlus
$irIndex = @{}
$irPkg = Open-ExcelPackage $prodPath
$irWs  = $irPkg.Workbook.Worksheets['Initial Requests']
if ($irWs.Dimension) {
    for ($r = 2; $r -le $irWs.Dimension.Rows; $r++) {
        $wid = $irWs.Cells[$r, 1].Text
        if (-not $wid) { continue }
        $irIndex[$wid] = @{
            RequesterName  = $irWs.Cells[$r, 5].Text
            RequesterEmail = $irWs.Cells[$r, 6].Text
            HireDate       = $irWs.Cells[$r, 7].Text
            EmploymentType = $irWs.Cells[$r, 10].Text
            SiteName       = $irWs.Cells[$r, 16].Text
            ManagerEmail   = $irWs.Cells[$r, 18].Text
            DateRequested  = $irWs.Cells[$r, 4].Text
            Systems        = $irWs.Cells[$r, 21].Text
            Equipment      = $irWs.Cells[$r, 22].Text
            CC_USA         = $irWs.Cells[$r, 31].Text
            CC_CAN         = $irWs.Cells[$r, 33].Text
            CC_HD          = $irWs.Cells[$r, 35].Text
            JonasJobs      = $irWs.Cells[$r, 45].Text
            Review306090   = $irWs.Cells[$r, 48].Text
        }
    }
}
$irPkg.Dispose()

$dvCols = @('Workflow ID','Employee Name','Global Status','Granular Step Details',
            'Requester Name','Requester Email','Initiator Email','Date Requested',
            'Last Updated','Manager Email','Requested Items JSON','Hire Date','Site','Employment Type')
$dvRows = [System.Collections.Generic.List[object]]::new()

foreach ($wf in $wfData) {
    $wid     = "$($wf.'Workflow ID')"
    if (-not $wid) { continue }

    $status  = "$($wf.'Status')"
    $step    = "$($wf.'Current Step')"
    $empName = "$($wf.'Employee Name')"
    $initEmail = "$($wf.'Initiator Email')"
    $lastUpd = "$($wf.'Last Updated')"

    $reqName  = ''; $reqEmail = ''; $mgrEmail = ''
    $dateReq  = ''; $hireDate = ''; $site = ''; $empType = ''
    $itemsJson = '{}'

    if ($irIndex.ContainsKey($wid)) {
        $ir = $irIndex[$wid]
        $reqName  = $ir.RequesterName
        $reqEmail = $ir.RequesterEmail
        $mgrEmail = $ir.ManagerEmail
        $dateReq  = $ir.DateRequested
        $hireDate = $ir.HireDate
        $site     = $ir.SiteName
        $empType  = $ir.EmploymentType

        $jonas    = ($ir.JonasJobs.Trim().Length -gt 0)
        $cc       = ($ir.CC_USA -eq 'Yes' -or $ir.CC_CAN -eq 'Yes' -or $ir.CC_HD -eq 'Yes')
        $fleetio  = ($ir.Systems -match 'Fleetio')
        $bizCards = ($ir.Equipment -match 'Business Cards')
        $sitedocs = ($ir.Systems -match 'SiteDocs' -or $ir.Equipment -match 'SiteDocs Tablet')
        $review   = ($ir.Review306090 -eq 'Yes')
        $itemsJson = "{""jonas"":$($jonas.ToString().ToLower()),""creditCard"":$($cc.ToString().ToLower()),""fleetio"":$($fleetio.ToString().ToLower()),""businessCards"":$($bizCards.ToString().ToLower()),""siteDocs"":$($sitedocs.ToString().ToLower()),""review"":$($review.ToString().ToLower()),""safety"":true}"
    }

    $dvRows.Add([PSCustomObject]@{
        'Workflow ID'          = $wid
        'Employee Name'        = $empName
        'Global Status'        = $status
        'Granular Step Details'= $step
        'Requester Name'       = $reqName
        'Requester Email'      = $reqEmail
        'Initiator Email'      = $initEmail
        'Date Requested'       = $dateReq
        'Last Updated'         = $lastUpd
        'Manager Email'        = $mgrEmail
        'Requested Items JSON' = $itemsJson
        'Hire Date'            = $hireDate
        'Site'                 = $site
        'Employment Type'      = $empType
    })
}

$dvPadded = Pad-Objects $dvRows $dvCols
Export-Excel -Path $devPath -WorksheetName 'Dashboard_View' -InputObject $dvPadded -ClearSheet -NoNumberConversion *
Write-Host "  Dashboard_View: $($dvRows.Count) rows"

Write-Host "`n=== Done! File saved: $devPath ==="
