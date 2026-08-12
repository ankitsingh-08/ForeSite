$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$f = 'c:\Users\Mmpl\Documents\Agent\Asset_Performance_Matrix_Report.xlsx'

if (Test-Path $f) {
    Write-Host "File: $f"
    try {
        $wb = $excel.Workbooks.Open($f)
        foreach ($sheet in $wb.Sheets) {
            $usedRange = $sheet.UsedRange
            $rows = $usedRange.Rows.Count
            $cols = $usedRange.Columns.Count
            Write-Host "  Sheet: $($sheet.Name) | Rows: $rows | Cols: $cols"
            
            # Print row 1 headers
            $headers = @()
            for ($c = 1; $c -le $cols; $c++) {
                $val = $sheet.Cells.Item(1, $c).Text
                if ($val) { $headers += $val }
            }
            Write-Host "    Headers: $($headers -join ', ')"
        }
        $wb.Close($false)
    } catch {
        Write-Host "  Error: $_"
    }
} else {
    Write-Host "File not found!"
}
$excel.Quit()
