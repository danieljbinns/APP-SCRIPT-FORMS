param(
    [string]$VersionMessage = "Automated deployment"
)

# Push changes to Apps Script project
clasp push

# Create a new version and capture its number
$verOutput = clasp version $VersionMessage
if ($verOutput -match "Version (\d+)") {
    $verNumber = $Matches[1]
    Write-Host "Created version $verNumber"
}
else {
    Write-Error "Failed to create version"
    exit 1
}

# Deploy the new version (replace 0 with your deployment ID if needed)
clasp deploy -i 0 -d $VersionMessage -v $verNumber

Write-Host "Deployment complete."
