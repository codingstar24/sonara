# Sonara GitHub Push & Release Helper
param (
    [string]$RepoUrl
)

Write-Host "`n=== Sonara GitHub Setup & Upload ===" -ForegroundColor Green

if (-not $RepoUrl) {
    $RepoUrl = Read-Host "`nEnter your GitHub Repository URL (e.g. https://github.com/<username>/sonara.git)"
}

if (-not $RepoUrl) {
    Write-Host "No repository URL provided. Aborting." -ForegroundColor Red
    exit 1
}

# Remove origin if already exists
git remote remove origin 2>$null

Write-Host "`nAdding remote origin: $RepoUrl" -ForegroundColor Cyan
git remote add origin $RepoUrl

Write-Host "Pushing main branch to GitHub..." -ForegroundColor Cyan
git push -u origin main

Write-Host "Pushing v1.0.0 tag to GitHub..." -ForegroundColor Cyan
git push origin --tags

Write-Host "`n=== Successfully Pushed to GitHub! ===" -ForegroundColor Green
Write-Host "`nYour repo is now live on GitHub."
Write-Host "To attach the downloadable .exe:"
Write-Host "1. Go to your repo -> Releases -> Create a new release (or choose tag v1.0.0)"
Write-Host "2. Drag and drop this file: dist-release\Sonara Setup 1.0.0.exe"
Write-Host "3. Click 'Publish release'!"
