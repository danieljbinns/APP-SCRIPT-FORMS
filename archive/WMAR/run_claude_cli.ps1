# run_claude_cli.ps1
param(
    [Parameter(Mandatory = $true)]
    [string]$PromptFile,   # Path to a text file containing the prompt
    [Parameter(Mandatory = $false)]
    [string]$OutputFile = "claude_output.txt"
)

# Ensure Claude CLI is installed and in PATH
if (-not (Get-Command "claude" -ErrorAction SilentlyContinue)) {
    Write-Error "Claude CLI not found in PATH. Please install it first."
    exit 1
}

# Read prompt
if (-not (Test-Path $PromptFile)) {
    Write-Error "Prompt file not found: $PromptFile"
    exit 1
}
$prompt = Get-Content -Path $PromptFile -Raw

# Call Claude CLI (example usage)
# Adjust arguments according to actual Claude CLI syntax
$response = & claude -p "$prompt"

# Save response
Set-Content -Path $OutputFile -Value $response

Write-Host "Claude response saved to $OutputFile"
