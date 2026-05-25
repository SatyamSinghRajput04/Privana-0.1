# Fix mojibake encoding corruption in AnalyzePage.tsx
$f = 'C:\Users\dell\NewProject\.vscode\Project\Privana\src\pages\AnalyzePage.tsx'
$content = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)

$replacements = @(
  # Em dash
  @{ From = [char]0x00E2 + [char]0x0080 + [char]0x0094; To = [char]0x2014 },
  # Right arrow
  @{ From = [char]0x00E2 + [char]0x0086 + [char]0x0092; To = [char]0x2192 },
  # Superscript 2 (²)
  @{ From = [char]0x00C2 + [char]0x00B2; To = [char]0x00B2 },
  # Greek small sigma (σ)
  @{ From = [char]0x00CF + [char]0x0083; To = [char]0x03C3 },
  # Triangle up (▲)
  @{ From = [char]0x00E2 + [char]0x0096 + [char]0x00B2; To = [char]0x25B2 },
  # Triangle down (▼)
  @{ From = [char]0x00E2 + [char]0x0096 + [char]0x00BC; To = [char]0x25BC },
  # Times / multiplication (×)
  @{ From = [char]0x00C3 + [char]0x0097; To = [char]0x00D7 },
  # y-hat (ŷ)
  @{ From = [char]0x00C5 + [char]0x00B7; To = [char]0x0177 },
  # Middle dot (·)
  @{ From = [char]0x00C2 + [char]0x00B7; To = [char]0x00B7 },
  # Box drawing horizontal (─)
  @{ From = [char]0x00E2 + [char]0x0094 + [char]0x0080; To = [char]0x2500 },
  # Box drawing double horizontal (═)
  @{ From = [char]0x00E2 + [char]0x0095 + [char]0x0090; To = [char]0x2550 },
  # En dash (–)
  @{ From = [char]0x00E2 + [char]0x0080 + [char]0x0093; To = [char]0x2013 }
)

# Also do simple string replacements for common patterns
$strReplacements = @(
  @('RÂ²', 'R²'),
  @('Ïƒ', 'σ'),
  @('â€"', '—'),
  @('â€"', '—'),
  @('â†'', '→'),
  @('Ã—', '×'),
  @('â–²', '▲'),
  @('â–¼', '▼'),
  @('Å·', 'ŷ'),
  @('Â·', '·'),
  @('â"€', '─'),
  @('â•', '═'),
  @('â•â•', '══'),
  @('ðŸ"', '📐'),
  @('ðŸ"‰', '📉'),
  @('ðŸ"Š', '📊'),
  @('ðŸ†', '🏆'),
  @('ðŸ"¦', '📦'),
  @('ðŸ¥§', '🥧'),
  @('ðŸ"‚', '📂'),
  @('âœ•', '✕'),
  @('â† ', '← '),
  @('â†'', '→'),
  @('Â²', '²'),
  @('ðŸŽ¨', '🎨'),
  @('ðŸ"', '🔍'),
  @('âš¡', '⚡'),
  @('ðŸ" ', '🔐'),
  @('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•', '═══════════════════════════════════════════════════════════════════'),
  @('â"€â"€ Dashboard Header Bar â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€', '── Dashboard Header Bar ────────────────────────────────────────'),
  @('â"€â"€ Collapsible Insight Banner (appears for stat queries) â"€â"€â"€â"€â"€â"€â"€', '── Collapsible Insight Banner (appears for stat queries) ───────'),
  @('â"€â"€ KPI Cards Row â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€', '── KPI Cards Row ───────────────────────────────────────────────'),
  @('â"€â"€ Row 1: Primary Chart + Right Column â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€', '── Row 1: Primary Chart + Right Column ─────────────────────────'),
  @('UNIFIED DASHBOARD SHELL â€" permanent operating system', 'UNIFIED DASHBOARD SHELL — permanent operating system'),
  @('All query types render inside this grid. Only data changes.', 'All query types render inside this grid. Only data changes.')
)

foreach ($pair in $strReplacements) {
  $content = $content.Replace($pair[0], $pair[1])
}

[System.IO.File]::WriteAllText($f, $content, (New-Object System.Text.UTF8Encoding $false))
Write-Host "Done. File size: $((Get-Item $f).Length) bytes"
