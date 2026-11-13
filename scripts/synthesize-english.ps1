param([string]$InputPath, [string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $voice = $speaker.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -eq 'en-US' } | Select-Object -First 1
  if (-not $voice) { throw 'Install a Windows en-US speech voice before generating the audio pack.' }
  $speaker.SelectVoice($voice.VoiceInfo.Name)
  $speaker.Rate = -2
  $entries = Get-Content -LiteralPath $InputPath -Raw -Encoding UTF8 | ConvertFrom-Json
  foreach ($entry in $entries) {
    $speaker.SetOutputToWaveFile((Join-Path $OutputDirectory ($entry.key + '.wav')))
    $speaker.Speak($entry.text)
    $speaker.SetOutputToNull()
  }
} finally { $speaker.Dispose() }
