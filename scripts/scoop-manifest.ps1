# Writes the Scoop manifest for one release. The Release workflow publishes it next to
# the installers, so this address always installs the latest version:
#   scoop install https://github.com/awizzz/shelduck/releases/latest/download/shelduck.json
# Scoop keeps that address and reads it again on `scoop update`.
param(
    [Parameter(Mandatory)] [string] $Version,
    [Parameter(Mandatory)] [string] $Zip,
    [string] $Arm64Zip,
    [Parameter(Mandatory)] [string] $Repository,
    [Parameter(Mandatory)] [string] $Out
)

$ErrorActionPreference = 'Stop'

$manifest = [ordered]@{
    version      = $Version
    description  = 'A fast, good-looking Windows terminal with its own Linux-style shell.'
    homepage     = 'https://shelduck.awizz.space'
    license      = [ordered]@{
        identifier = 'PolyForm-Shield-1.0.0'
        url        = "https://github.com/$Repository/blob/main/LICENSE"
    }
    notes        = 'Settings > Behavior can add Open in Shelduck to File Explorer and make it the default terminal of Windows 11.'
    architecture = [ordered]@{
        '64bit' = [ordered]@{
            url  = "https://github.com/$Repository/releases/download/v$Version/$(Split-Path $Zip -Leaf)"
            hash = (Get-FileHash $Zip -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    }
    # Each pair is one entry: a file and the command that starts it. nebula-terminal
    # was the command before 3.0.
    bin          = @(@('Shelduck.exe', 'shelduck'), @('Shelduck.exe', 'nebula-terminal'), 'shelduck-sh.exe')
    shortcuts    = @(, @('Shelduck.exe', 'Shelduck'))
}

if ($Arm64Zip) {
    $manifest.architecture['arm64'] = [ordered]@{
        url  = "https://github.com/$Repository/releases/download/v$Version/$(Split-Path $Arm64Zip -Leaf)"
        hash = (Get-FileHash $Arm64Zip -Algorithm SHA256).Hash.ToLowerInvariant()
    }
}

$manifest | ConvertTo-Json -Depth 5 | Set-Content $Out -Encoding utf8NoBOM
