$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$files = @(
    'C:\Users\Mmpl\Documents\MMU\Machines\1.MPR\BD details Jan1st _Mar31st.xlsx',
    'C:\Users\Mmpl\Documents\MMU\Machines\1.MPR\APRIL BD DETAILS.xlsx',
    'C:\Users\Mmpl\Downloads\MTTR & MTBF, BD Reports.xlsx'
)

foreach ($f in $files) {
    if (Test-Path $f) {
        Write-Host "`nFile: $f"
        try {
            $wb = $excel.Workbooks.Open($f)
            foreach ($sheet in $wb.Sheets) {
                $usedRange = $sheet.UsedRange
                $rows = $usedRange.Rows.Count
                $cols = $usedRange.Columns.Count
                
                # Get headers (row 1)
                $headers = @()
                for ($c = 1; $c -le $cols; $c++) {
                    $val = $sheet.Cells.Item(1, $c).Text
                    if ($val) { $headers += $val }
                }
                Write-Host "  Sheet: $($sheet.Name) | Rows: $rows | Cols: $cols"
                Write-Host "    Headers: $($headers -join ', ')"
            }
            $wb.Close($false)
        } catch {
            Write-Host "  Error: $_"
        }
    } else {
        Write-Host "File not found: $f"
    }
}

$excel.Quit()
