$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$extracted = @{
    machines = @()
    breakdowns = @()
}

# 1. Extract Machines from MTTR-MTBF Sheet
$mttrFile = 'C:\Users\Mmpl\Downloads\MTTR & MTBF, BD Reports.xlsx'
if (Test-Path $mttrFile) {
    Write-Host "Extracting machines from $mttrFile [MTTR-MTBF]..."
    try {
        $wb = $excel.Workbooks.Open($mttrFile)
        $ws = $wb.Sheets.Item('MTTR-MTBF')
        $rows = $ws.UsedRange.Rows.Count
        
        # Row 1 is header
        for ($r = 2; $r -le $rows; $r++) {
            $assetName = $ws.Cells.Item($r, 1).Text.Trim()
            $assetCode = $ws.Cells.Item($r, 2).Text.Trim()
            $runningHrm = $ws.Cells.Item($r, 3).Text.Trim()
            $noOfTickets = $ws.Cells.Item($r, 5).Text.Trim()
            
            if (-not $assetCode) { continue }
            
            # Parse model and rig number
            # BNH-542|RIG-211 -> Model: BNH-542, Rig no: RIG-211
            $parts = $assetName -split '\|'
            $model = $parts[0].Trim()
            $rigNo = if ($parts.Length -gt 1) { $parts[1].Trim() } else { $assetCode }
            
            # Status: If there are breakdown hours or ticket state, determine status. Otherwise default to "Active" (Operating) or "Idle"
            $status = "Operating"
            if ($runningHrm -eq "Idle") { $status = "Idle" }
            
            # Parse hour meter
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
    Write-Host "Extracting breakdowns from Jan-Mar file..."
    try {
        $wb = $excel.Workbooks.Open($janMarFile)
        $ws = $wb.Sheets.Item('BD Details')
        $rows = $ws.UsedRange.Rows.Count
        
        for ($r = 2; $r -le $rows; $r++) {
            $slNo = $ws.Cells.Item($r, 1).Text.Trim()
            $localName = $ws.Cells.Item($r, 2).Text.Trim() # Rig no
            $assetType = $ws.Cells.Item($r, 3).Text.Trim()
            $date = $ws.Cells.Item($r, 4).Text.Trim()
            $durationMin = $ws.Cells.Item($r, 6).Text.Trim()
            $bdHours = $ws.Cells.Item($r, 7).Text.Trim()
            $bdTime = $ws.Cells.Item($r, 8).Text.Trim()
            $readyTime = $ws.Cells.Item($r, 9).Text.Trim()
            $category = $ws.Cells.Item($r, 10).Text.Trim()
            $remarks = $ws.Cells.Item($r, 11).Text.Trim()
            
            if (-not $localName -or $localName -eq "Local Name") { continue }
            
            # Format breakdown hours
            $hours = 0
            if ($bdHours -as [double]) {
                $hours = [double]$bdHours
            }
            
            $extracted.breakdowns += @{
                id = "BD-JM-$slNo"
                machineId = $localName
                partId = if ($category) { $category } else { "Mechanical" }
                reason = if ($remarks) { $remarks } else { "Breakdown reported ($category)" }
                date = $date
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
    Write-Host "Extracting breakdowns from April file..."
    try {
        $wb = $excel.Workbooks.Open($aprilFile)
        $ws = $wb.Sheets.Item('BD Details')
        $rows = $ws.UsedRange.Rows.Count
        
        for ($r = 2; $r -le $rows; $r++) {
            $assetName = $ws.Cells.Item($r, 1).Text.Trim() # Rig no
            $assetType = $ws.Cells.Item($r, 2).Text.Trim()
            $date = $ws.Cells.Item($r, 3).Text.Trim()
            $durationMin = $ws.Cells.Item($r, 5).Text.Trim()
            $bdHrs = $ws.Cells.Item($r, 6).Text.Trim()
            $startTime = $ws.Cells.Item($r, 7).Text.Trim()
            $endTime = $ws.Cells.Item($r, 8).Text.Trim()
            $defectCode = $ws.Cells.Item($r, 9).Text.Trim()
            $remarks = $ws.Cells.Item($r, 10).Text.Trim()
            
            if (-not $assetName -or $assetName -eq "Asset Name") { continue }
            
            $hours = 0
            if ($bdHrs -as [double]) {
                $hours = [double]$bdHrs
            }
            
            $extracted.breakdowns += @{
                id = "BD-AP-$r"
                machineId = $assetName
                partId = if ($defectCode) { $defectCode } else { "General" }
                reason = if ($remarks) { $remarks } else { "Breakdown reported ($defectCode)" }
                date = $date
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
    Write-Host "Extracting breakdowns from $mttrFile [BD]..."
    try {
        $wb = $excel.Workbooks.Open($mttrFile)
        $ws = $wb.Sheets.Item('BD')
        $rows = $ws.UsedRange.Rows.Count
        
        for ($r = 2; $r -le $rows; $r++) {
            $slNo = $ws.Cells.Item($r, 1).Text.Trim()
            $zone = $ws.Cells.Item($r, 2).Text.Trim()
            $site = $ws.Cells.Item($r, 3).Text.Trim()
            $model = $ws.Cells.Item($r, 4).Text.Trim()
            $rigNo = $ws.Cells.Item($r, 5).Text.Trim()
            $totalBdHours = $ws.Cells.Item($r, 6).Text.Trim() # format e.g. 02:30:00 or 74:00:00
            $bdTime = $ws.Cells.Item($r, 7).Text.Trim()
            $readyTime = $ws.Cells.Item($r, 8).Text.Trim()
            
            if (-not $rigNo -or $rigNo -eq "Rig no") { continue }
            
            # Parse total breakdown hours in duration
            # format 74:00:00 -> hours: 74
            $hours = 0.0
            if ($totalBdHours -match "^(\d+):(\d+)(:(\d+))?$") {
                $hours = [double]$Matches[1] + ([double]$Matches[2] / 60.0)
            } elseif ($totalBdHours -as [double]) {
                $hours = [double]$totalBdHours
            }
            
            # Extract date from bdTime (01-04-2026 at 07:00 AM)
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

# 5. Clean up Machine Statuses based on active breakdowns and write output
# Check if any machines are currently in active breakdown (downtime reported in late May or June 2026)
# If a machine is listed in BD sheet but running HRM has tickets, keep it aligned.
foreach ($m in $extracted.machines) {
    # Find matching breakdowns for this rig
    # We can match on machineId by fuzzy comparison, e.g., if m.id contains rigNo or vice-versa
    $matchedBds = $extracted.breakdowns | Where-Object { 
        $_.machineId -eq $m.id -or 
        $m.id -replace '\s' -match [regex]::Escape($_.machineId -replace '\s') -or 
        $_.machineId -replace '\s' -match [regex]::Escape($m.id -replace '\s')
    }
    
    # If the machine is active, let's normalize its id and match details
    # Let's clean the breakdown machineIds to match machine.id exactly
    foreach ($b in $matchedBds) {
        $b.machineId = $m.id
    }
}

# Write output to JSON file
$json = $extracted | ConvertTo-Json -Depth 5
$json | Out-File -FilePath 'c:\Users\Mmpl\Documents\Agent\src\extractedData.json' -Encoding utf8
Write-Host "Consolidation complete! Saved to src/extractedData.json"

$excel.Quit()
