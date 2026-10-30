param([Parameter(Mandatory=$true)][string]$Path, [Parameter(Mandatory=$true)][string]$Output)
$ErrorActionPreference = 'Stop'
$stream = [IO.FileStream]::new($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
$zip = [IO.Compression.ZipArchive]::new($stream)
function Read-Xml($name) {
    $entry = $zip.GetEntry($name)
    if (!$entry) { return $null }
    $reader = [IO.StreamReader]::new($entry.Open())
    try { return [xml]$reader.ReadToEnd() } finally { $reader.Dispose() }
}
try {
    $shared = Read-Xml 'xl/sharedStrings.xml'
    $strings = @()
    if ($shared) {
        $strings = @($shared.sst.si | Where-Object { $null -ne $_ } | ForEach-Object { ($_.SelectNodes('.//*[local-name()="t"]') | ForEach-Object { $_.InnerText }) -join '' })
    }
    $book = Read-Xml 'xl/workbook.xml'
    $rels = Read-Xml 'xl/_rels/workbook.xml.rels'
    $styles = Read-Xml 'xl/styles.xml'
    $formats = @{}
    foreach ($fmt in $styles.styleSheet.numFmts.numFmt) { $formats[[string]$fmt.numFmtId] = [string]$fmt.formatCode }
    $xfs = @($styles.styleSheet.cellXfs.xf)
    $sheets = @()
    foreach ($sheet in $book.workbook.sheets.sheet) {
        $rid = $sheet.GetAttribute('id','http://schemas.openxmlformats.org/officeDocument/2006/relationships')
        $rel = $rels.Relationships.Relationship | Where-Object { $_.Id -eq $rid }
        $target = [string]$rel.Target
        $target = if ($target.StartsWith('/')) { $target.TrimStart('/') } else { 'xl/' + $target }
        $xml = Read-Xml $target
        $rows = @()
        foreach ($row in $xml.worksheet.sheetData.row) {
            $cells = [ordered]@{}
            foreach ($cell in $row.c) {
                $value = [string]$cell.v
                if ($cell.t -eq 's') { $value = $strings[[int]$value] }
                elseif ($cell.t -eq 'inlineStr') { $value = ($cell.SelectNodes('.//*[local-name()="t"]') | ForEach-Object { $_.InnerText }) -join '' }
                elseif ($value -ne '' -and $cell.s) {
                    $format = $formats[[string]$xfs[[int]$cell.s].numFmtId]
                    if ($format -cmatch '^0+$' -and $value -match '^\d+$') { $value = $value.PadLeft($format.Length,'0') }
                }
                if ($value.Trim() -ne '') { $cells[[string]$cell.r] = $value }
            }
            if ($cells.Count) { $rows += [ordered]@{row=[int]$row.r; cells=$cells} }
        }
        $sheets += [ordered]@{name=[string]$sheet.name; hidden=([string]$sheet.state -eq 'hidden'); rows=$rows}
    }
    @{sheets=$sheets} | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $Output -Encoding utf8
} finally { $zip.Dispose(); $stream.Dispose() }
