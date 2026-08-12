$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$extracted = @{
    machines = @()
    breakdowns = @()
}

# Helper to read multidimensional array from COM
function Get-Val($arr, $r, $c) {
    try {
        $val = $arr[$r, $c]
        if ($val -eq $null) { return "" }
        return $val.ToString().Trim()
    } catch {
        return ""
    }
}

# 1. Extract Machines
$mttrFile = 'C:\Users\Mmpl\Downloads\MTTR & MTBF, BD Reports.xlsx'
if (Test-Path $mttrFile) {
    Write-Host "Extracting machines fast..."
    try {
        $wb = $excel.Workbooks.Open($mttrFile)
        $ws = $wb.Sheets.Item('MTTR-MTBF')
        $range = $ws.UsedRange
        $rows = $range.Rows.Count
        $data = $range.Value2
        
        for ($r = 2; $r -le $rows; $r++) {
            $assetName = Get-Val $data $r 1
            $assetCode = Get-Val $data $r 2
            $runningHrm = Get-Val $data $r 3
            
            if (-not $assetCode) { continue }
            
            $parts = $assetName -split '\|'
            $model = $parts[0].Trim()
            $rigNo = if ($parts.Length -gt 1) { $parts[1].Trim() } else { $assetCode }
            
            $status = "Operating"
            if ($runningHrm -eq "Idle") { $status = "Idle" }
            
            $hourMeter = 0
            if ($runningHrm -as [double]) {
                $hourMeter = [double]$runningHrm
            }
            
            $extracted.machines += @{
                id = $rigNo
                assetCode = $assetCode
                name = $assetName
                model = $model
                type = "Drill Rig"
                status = $status
                hourMeter = $hourMeter
                fuelRate = if ($model -match "BNH") { 5.6 } else { 2.3 }
                productivity = 85
                fuelType = "Diesel"
                engineOperated = $true
            }
        }
        $wb.Close($false)
    } catch {
        Write-Host "Error parsing machines: $_"
    }
}

# 2. Extract Breakdowns from Jan 1st to Mar 31st
$janMarFile = 'C:\Users\Mmpl\Documents\MMU\Machines\1.MPR\BD details Jan1st _Mar31st.xlsx'
if (Test-Path $janMarFile) {
    Write-Host "Extracting breakdowns Jan-Mar fast..."
    try {
        $wb = $excel.Workbooks.Open($janMarFile)
        $ws = $wb.Sheets.Item('BD Details')
        $range = $ws.UsedRange
        $rows = $range.Rows.Count
        $data = $range.Value2
        
        for ($r = 2; $r -le $rows; $r++) {
            $slNo = Get-Val $data $r 1
            $localName = Get-Val $data $r 2
            $assetType = Get-Val $data $r 3
            $dateNum = Get-Val $data $r 4 # Excel date serial
            $durationMin = Get-Val $data $r 6
            $bdHours = Get-Val $data $r 7
            $bdTime = Get-Val $data $r 8
            $readyTime = Get-Val $data $r 9
            $category = Get-Val $data $r 10
            $remarks = Get-Val $data $r 11
            
            if (-not $localName -or $localName -eq "Local Name") { continue }
            
            $hours = 0
            if ($bdHours -as [double]) { $hours = [double]$bdHours }
            
            # Convert Excel date serial if it's a number
            $formattedDate = $dateNum
            if ($dateNum -match "^\d+$" -or $dateNum -match "^\d+\.\d+$") {
                try {
                    $formattedDate = [DateTime]::FromOADate([double]$dateNum).ToString("dd-MM-yyyy")
                } catch {}
            }
            
            $extracted.breakdowns += @{
                id = "BD-JM-$slNo"
                machineId = $localName
                partId = if ($category) { $category } else { "Mechanical" }
                reason = if ($remarks) { $remarks } else { "Breakdown reported ($category)" }
                date = $formattedDate
                downHours = $hours
                startDateTime = $bdTime
                endDateTime = $readyTime
                severity = "Medium"
            }
        }
        $wb.Close($false)
    } catch {
        Write-Host "Error parsing Jan-Mar: $_"
    }
}

# 3. Extract Breakdowns from April
$aprilFile = 'C:\Users\Mmpl\Documents\MMU\Machines\1.MPR\APRIL BD DETAILS.xlsx'
if (Test-Path $aprilFile) {
    Write-Host "Extracting breakdowns April fast..."
    try {
        $wb = $excel.Workbooks.Open($aprilFile)
        $ws = $wb.Sheets.Item('BD Details')
        $range = $ws.UsedRange
        $rows = $range.Rows.Count
        $data = $range.Value2
        
        for ($r = 2; $r -le $rows; $r++) {
            $assetName = Get-Val $data $r 1
            $assetType = Get-Val $data $r 2
            $dateNum = Get-Val $data $r 3
            $bdHrs = Get-Val $data $r 6
            $startTime = Get-Val $data $r 7
            $endTime = Get-Val $data $r 8
            $defectCode = Get-Val $data $r 9
            $remarks = Get-Val $data $r 10
            
            if (-not $assetName -or $assetName -eq "Asset Name") { continue }
            
            $hours = 0
            if ($bdHrs -as [double]) { $hours = [double]$bdHrs }
            
            $formattedDate = $dateNum
            if ($dateNum -match "^\d+$" -or $dateNum -match "^\d+\.\d+$") {
                try {
                    $formattedDate = [DateTime]::FromOADate([double]$dateNum).ToString("dd-MM-yyyy")
                } catch {}
            }
            
            $extracted.breakdowns += @{
                id = "BD-AP-$r"
                machineId = $assetName
                partId = if ($defectCode) { $defectCode } else { "General" }
                reason = if ($remarks) { $remarks } else { "Breakdown reported ($defectCode)" }
                date = $formattedDate
                downHours = $hours
                startDateTime = $startTime
                endDateTime = $endTime
                severity = "Medium"
            }
        }
        $wb.Close($false)
    } catch {
        Write-Host "Error parsing April: $_"
    }
}

# 4. Extract Breakdowns from MTTR-MTBF File (Sheet: BD)
if (Test-Path $mttrFile) {
    Write-Host "Extracting breakdowns MTTR BD fast..."
    try {
        $wb = $excel.Workbooks.Open($mttrFile)
        $ws = $wb.Sheets.Item('BD')
        $range = $ws.UsedRange
        $rows = $range.Rows.Count
        $data = $range.Value2
        
        for ($r = 2; $r -le $rows; $r++) {
            $slNo = Get-Val $data $r 1
            $zone = Get-Val $data $r 2
            $site = Get-Val $data $r 3
            $model = Get-Val $data $r 4
            $rigNo = Get-Val $data $r 5
            $totalBdHours = Get-Val $data $r 6
            $bdTime = Get-Val $data $r 7
            $readyTime = Get-Val $data $r 8
            
            if (-not $rigNo -or $rigNo -eq "Rig no") { continue }
            
            $hours = 0.0
            if ($totalBdHours -match "^(\d+):(\d+)(:(\d+))?$") {
                $hours = [double]$Matches[1] + ([double]$Matches[2] / 60.0)
            } elseif ($totalBdHours -as [double]) {
                $hours = [double]$totalBdHours
            }
            
            $date = ""
            if ($bdTime -match "^(\d{2}-\d{2}-\d{4})") {
                $date = $Matches[1]
            }
            
            $extracted.breakdowns += @{
                id = "BD-MT-$slNo"
                machineId = $rigNo
                partId = "Rig Mechanical"
                reason = "Site: $site. Model: $model. Zone: $zone."
                date = $date
                downHours = $hours
                startDateTime = $bdTime
                endDateTime = $readyTime
                severity = "Medium"
            }
        }
        $wb.Close($false)
    } catch {
        Write-Host "Error parsing MTTR BD: $_"
    }
}

# Normalization of machineIds
foreach ($m in $extracted.machines) {
    $matchedBds = $extracted.breakdowns | Where-Object { 
        $_.machineId -eq $m.id -or 
        $m.id -replace '\s' -match [regex]::Escape($_.machineId -replace '\s') -or 
        $_.machineId -replace '\s' -match [regex]::Escape($m.id -replace '\s')
    }
    foreach ($b in $matchedBds) {
        $b.machineId = $m.id
    }
}

# Output to JSON
$json = $extracted | ConvertTo-Json -Depth 5
$json | Out-File -FilePath 'c:\Users\Mmpl\Documents\Agent\src\extractedData.json' -Encoding utf8
Write-Host "Fast consolidation complete! Saved to src/extractedData.json"

$excel.Quit()
