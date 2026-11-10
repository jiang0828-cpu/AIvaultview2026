param([Parameter(Mandatory=$true)][string]$SourceDirectory)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = Split-Path $PSScriptRoot -Parent
$mediaDirectory = Join-Path $root 'backend/media/projects/literature'
New-Item -ItemType Directory -Path $mediaDirectory -Force | Out-Null
$definitions = @(
  @{ name='文学百家项目说明.docx'; key='project'; file='project-description.docx' },
  @{ name='文学百家产品与技术文档.docx'; key='technical'; file='product-technical.docx' }
)
$documents = @()
foreach ($definition in $definitions) {
  $source = Join-Path $SourceDirectory $definition.name
  $archive = [IO.Compression.ZipFile]::OpenRead($source)
  try {
    $reader = [IO.StreamReader]::new($archive.GetEntry('word/document.xml').Open())
    try { [xml]$xml = $reader.ReadToEnd() } finally { $reader.Dispose() }
    $ns = [Xml.XmlNamespaceManager]::new($xml.NameTable)
    $ns.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
    $blocks = [Collections.Generic.List[string]]::new()
    foreach ($block in $xml.SelectSingleNode('//w:body', $ns).ChildNodes) {
      if ($block.LocalName -eq 'p') {
        $text = ($block.SelectNodes('.//w:t', $ns) | ForEach-Object { $_.InnerText }) -join ''
        if (!$text) { continue }
        if ($text -match '^\d+\.\d+\s') { $text = '### ' + $text }
        elseif ($text -match '^\d+\s') { $text = '## ' + $text }
        $blocks.Add($text)
      } elseif ($block.LocalName -eq 'tbl') {
        $rows = @($block.SelectNodes('./w:tr', $ns))
        for ($i=0; $i -lt $rows.Count; $i++) {
          $cells = @($rows[$i].SelectNodes('./w:tc', $ns) | ForEach-Object {
            $paragraphs = @($_.SelectNodes('./w:p', $ns) | ForEach-Object {
              ($_.SelectNodes('.//w:t', $ns) | ForEach-Object { $_.InnerText }) -join ''
            })
            ($paragraphs -join ' / ').Replace('|','\|')
          })
          $blocks.Add('| ' + ($cells -join ' | ') + ' |')
          if ($i -eq 0) { $blocks.Add('| ' + ((@('---') * $cells.Count) -join ' | ') + ' |') }
        }
        $blocks.Add('')
      }
    }
    $markdown = ($blocks -join "`n`n") -replace '\|\r?\n\r?\n\|', "|`n|"
    $documents += @{ key=$definition.key; title=[IO.Path]::GetFileNameWithoutExtension($definition.name); markdown=$markdown; fileUrl=('/media/projects/literature/' + $definition.file) }
    Copy-Item -LiteralPath $source -Destination (Join-Path $mediaDirectory $definition.file) -Force
  } finally { $archive.Dispose() }
}
$json = ConvertTo-Json -InputObject @($documents) -Depth 5
$output = Join-Path $root 'backend/prisma/literature-sources.ts'
[IO.File]::WriteAllText($output, "// Generated from the supplied DOCX files by import-literature-documents.ps1.`nexport const literatureSources = $json;`n", [Text.UTF8Encoding]::new($false))
Write-Output ('Imported ' + $documents.Count + ' source documents; retained paragraphs and table rows.')
