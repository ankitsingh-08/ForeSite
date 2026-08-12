$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

function Inspect-Sheet($filePath, $sheetName) {
    if (-not (Test-Path $filePath)) { return }
    Write-Host "`n=== File: $filePath | Sheet: $sheetName ==="
    try {
        $wb = $excel.Workbooks.Open($filePath)
        $ws = $wb.Sheets.Item($sheetName)
        
        # Read first 10 rows, first 12 columns
        for ($r = 1; $r -le 10; $r++) {
            $rowValues = @()
            for ($c = 1; $c -le 12; $c++) {
                $cellVal = $ws.Cells.Item($r, $c).Text
                $rowValues += "'$cellVal'"
            }
            Write-Host ("Row {0:D2}: " -f $r) ($rowValues -join ", ")
        }
        $wb.Close($false)
    } catch {
        Write-Host "Error: $_"
    }
}

Inspect-Sheet 'C:\Users\Mmpl\Downloads\MTTR & MTBF, BD Reports.xlsx' 'BD'
Inspect-Sheet 'C:\Users\Mmpl\Downloads\MTTR & MTBF, BD Reports.xlsx' 'MTTR-MTBF'
Inspect-Sheet 'C:\Users\Mmpl\Desktop\Performance-Detailed.xlsx' 'Source Data'
Inspect-Sheet 'C:\Users\Mmpl\Desktop\Asset_Performance_Matrix_Report.xlsx' 'Asset_Performance_Matrix_Report'

$excel.Quit()
