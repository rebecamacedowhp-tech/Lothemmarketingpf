# Acompanha a Cibelle ao vivo: cada mensagem que chega no WhatsApp e o que a IA fez com ela.
# Lê os registros do servidor da Vercel a cada 15 segundos. Ctrl+C para parar.
$ErrorActionPreference = 'SilentlyContinue'
Set-Location (Split-Path $PSScriptRoot -Parent)
$vistos = @{}
Write-Host ''
Write-Host '  Vigiando a Cibelle (crm.lothem.com.br). Mande uma mensagem do celular de teste.' -ForegroundColor Cyan
Write-Host '  Ctrl+C para parar.' -ForegroundColor DarkGray
Write-Host ''
while ($true) {
  $linhas = npx --yes vercel@latest logs -n 50 --json 2>$null
  $novos = @()
  foreach ($l in $linhas) {
    try { $d = $l | ConvertFrom-Json } catch { continue }
    $x = $d.data; if (-not $x) { $x = $d }
    $msg = [string]$x.message
    if (-not $msg) { continue }
    $chave = [string]$x.timestamp + $msg
    if ($vistos.ContainsKey($chave)) { continue }
    $vistos[$chave] = 1
    $novos += [pscustomobject]@{ t = [string]$x.timestamp; m = $msg; lvl = [string]$x.level }
  }
  foreach ($n in ($novos | Sort-Object t)) {
    $hora = ([datetime]$n.t).ToLocalTime().ToString('HH:mm:ss')
    if ($n.m -like 'webhook*') {
      $j = $n.m.Substring(8) | ConvertFrom-Json
      if (-not $j.ia) { Write-Host "  $hora  mensagem registrada (sem texto ou enviada por voce)" -ForegroundColor DarkGray; continue }
      if ($j.ia.respondeu) { Write-Host "  $hora  CIBELLE RESPONDEU com $($j.ia.baloes) mensagem(ns)" -ForegroundColor Green }
      elseif ($j.ia.sugeriu) { Write-Host "  $hora  Cibelle deixou SUGESTAO no CRM ($($j.ia.motivo))" -ForegroundColor Yellow }
      else { Write-Host "  $hora  Cibelle NAO respondeu: $($j.ia.motivo)" -ForegroundColor Red }
    } elseif ($n.lvl -eq 'error' -or $n.m -like '*falhou*' -or $n.m -like '*Error*') {
      Write-Host "  $hora  ERRO: $($n.m.Substring(0, [Math]::Min(300, $n.m.Length)))" -ForegroundColor Red
    }
  }
  Start-Sleep -Seconds 15
}
