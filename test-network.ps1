# Script PowerShell pour tester la connectivité réseau
Write-Host "🔍 Test de connectivité réseau vers les serveurs Neon..." -ForegroundColor Cyan

$servers = @(
    "ep-wild-butterfly-a8eg2dmf.eastus2.azure.neon.tech",
    "ep-wild-butterfly-a8eg2dmf-pooler.eastus2.azure.neon.tech", 
    "ep-cool-fire-a5efc9dk.us-east-2.aws.neon.tech",
    "ep-cool-fire-a5efc9dk-pooler.us-east-2.aws.neon.tech"
)

foreach ($server in $servers) {
    Write-Host "`n📡 Test de $server..." -ForegroundColor Yellow
    
    # Test ping
    $pingResult = Test-Connection -ComputerName $server -Count 2 -Quiet
    if ($pingResult) {
        Write-Host "✅ Ping réussi" -ForegroundColor Green
    } else {
        Write-Host "❌ Ping échoué" -ForegroundColor Red
    }
    
    # Test port 5432
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $connect = $tcpClient.BeginConnect($server, 5432, $null, $null)
        $wait = $connect.AsyncWaitHandle.WaitOne(3000, $false)
        
        if ($wait) {
            $tcpClient.EndConnect($connect)
            Write-Host "✅ Port 5432 ouvert" -ForegroundColor Green
        } else {
            Write-Host "❌ Port 5432 fermé/inaccessible" -ForegroundColor Red
        }
        $tcpClient.Close()
    } catch {
        Write-Host "❌ Erreur de connexion port 5432: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n🏁 Test de connectivité terminé" -ForegroundColor Cyan
