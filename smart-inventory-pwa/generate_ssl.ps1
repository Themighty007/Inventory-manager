$opensslPath = "C:\Program Files\Git\usr\bin\openssl.exe"
if (-not (Test-Path $opensslPath)) {
    $opensslPath = "C:\Program Files\Git\mingw64\bin\openssl.exe"
}

$workDir = $PSScriptRoot
$certsDir = Join-Path $workDir "certs"
if (-not (Test-Path $certsDir)) {
    New-Item -ItemType Directory -Path $certsDir -Force | Out-Null
}

$cnfPath = Join-Path $certsDir "openssl.cnf"
$certPath = Join-Path $certsDir "cert.pem"
$keyPath = Join-Path $certsDir "key.pem"

# Get current LAN IPv4
$lanIp = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi*" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty IPAddress -First 1)
if (-not $lanIp) {
    $lanIp = "192.168.29.243"
}

Write-Host "Detected LAN IP for SSL certificate: $lanIp"

$cnfContent = @"
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = $lanIp
O = Smart Electronics Inventory
C = IN

[v3_req]
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
IP.2 = $lanIp
"@

[System.IO.File]::WriteAllText($cnfPath, $cnfContent)

Write-Host "Generating self-signed SSL certificate with Subject Alternative Names..."
& $opensslPath req -x509 -nodes -days 1825 -newkey rsa:2048 -keyout $keyPath -out $certPath -config $cnfPath

if ((Test-Path $certPath) -and (Test-Path $keyPath)) {
    Write-Host "SUCCESS: Generated SSL certificate ($certPath) and private key ($keyPath)"
    Remove-Item $cnfPath -ErrorAction SilentlyContinue
} else {
    Write-Error "Failed to generate certificates."
}
