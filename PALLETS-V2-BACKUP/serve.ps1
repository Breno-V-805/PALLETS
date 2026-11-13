# PALLETS Local HTTP Server & SNS Agent Workbench API Proxy
param(
    [int]$Port = 8080
)

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
    Write-Host "[PALLETS] Enterprise AI Server active at $prefix"
    Write-Host "[PALLETS] SNS Agent Proxy enabled at $prefix" + "api/sns-agent-proxy"
    Write-Host "[PALLETS] Press Ctrl+C to terminate."
    Start-Process $prefix
} catch {
    Write-Warning "Could not bind to $prefix. Falling back to direct browser launch..."
    Start-Process "file://$PSScriptRoot/index.html"
    exit
}

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".svg"  = "image/svg+xml"
}

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    # CORS Headers for API requests
    $response.AddHeader("Access-Control-Allow-Origin", "*")
    $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    $response.AddHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

    # Handle OPTIONS preflight
    if ($request.HttpMethod -eq "OPTIONS") {
        $response.StatusCode = 200
        $response.Close()
        continue
    }

    $urlPath = $request.Url.LocalPath.TrimStart('/')

    # SNS Agent API Proxy Endpoint
    if ($urlPath -eq "api/sns-agent-proxy") {
        $targetUrl = $request.QueryString["target"]
        if ([string]::IsNullOrWhiteSpace($targetUrl)) {
            $targetUrl = "https://api.agents.snsihub.ai/webhook/cc0a6272-8aba-45b2-916a-b44905b2386a"
        }

        try {
            $bodyStream = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
            $postData = $bodyStream.ReadToEnd()
            
            # Forward to api.agents.snsihub.ai
            $wc = New-Object System.Net.WebClient
            $wc.Headers.Add("Content-Type", "application/json")
            if ($request.Headers["Authorization"]) {
                $wc.Headers.Add("Authorization", $request.Headers["Authorization"])
            }
            
            $proxyResult = $wc.UploadString($targetUrl, "POST", $postData)
            $resBytes = [System.Text.Encoding]::UTF8.GetBytes($proxyResult)
            
            $response.ContentType = "application/json; charset=utf-8"
            $response.StatusCode = 200
            $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
        } catch {
            $errJson = "{`"status`":`"standby`",`"message`":`"SNS Agent Workflow standby`",`"error`":`"$($_.Exception.Message)`"}"
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes($errJson)
            $response.ContentType = "application/json; charset=utf-8"
            $response.StatusCode = 200
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }
        $response.Close()
        continue
    }

    if ([string]::IsNullOrWhiteSpace($urlPath)) {
        $urlPath = "index.html"
    }

    $filePath = Join-Path $PSScriptRoot $urlPath

    if (Test-Path $filePath -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
        $contentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        
        $response.ContentType = $contentType
        $response.ContentLength64 = $bytes.Length
        $response.StatusCode = 200
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $response.StatusCode = 404
        $notFoundMsg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
        $response.OutputStream.Write($notFoundMsg, 0, $notFoundMsg.Length)
    }
    $response.Close()
}
