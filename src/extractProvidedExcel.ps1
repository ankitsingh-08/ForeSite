$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$f = 'c:\Users\Mmpl\Documents\Agent\Asset_Performance_Matrix_Report.xlsx'

if (Test-Path $f) {
    try {
        $wb = $excel.Workbooks.Open($f)
        $ws = $wb.Sheets.Item(1) # First sheet
        $range = $ws.UsedRange
        $rows = $range.Rows.Count
        $cols = $range.Columns.Count
        $data = $range.Value2
        
        Write-Host "Extracting $rows rows and $cols columns..."
        
        # We will parse headers from Row 1
        $headers = @()
        for ($c = 1; $c -le $cols; $c++) {
            $val = $data[1, $c]
            if ($val) { $headers += $val.ToString().Trim() } else { $headers += "Col$c" }
        }
        
        $records = @()
        
        for ($r = 2; $r -le $rows; $r++) {
            $record = @{}
            for ($c = 1; $c -le $cols; $c++) {
                $colHeader = $headers[$c - 1]
                $val = $data[$r, $c]
                if ($val -eq $null) {
                    $record[$colHeader] = ""
                } else {
                    $record[$colHeader] = $val.ToString().Trim()
                }
            }
            # Skip empty rows (must have asset code or name)
            if ($record['Asset Code'] -or $record['Asset Name']) {
                $records += $record
            }
        }
        
        $records | ConvertTo-Json -Depth 5 | Out-File -FilePath 'c:\Users\Mmpl\Documents\Agent\src\extractedAssetData.json' -Encoding utf8
        Write-Host "Extraction complete! Saved $($records.Length) records to src/extractedAssetData.json"
        
        $wb.Close($false)
    } catch {
        Write-Host "Error: $_"
    }
} else {
    Write-Host "File not found!"
}

$excel.Quit()
