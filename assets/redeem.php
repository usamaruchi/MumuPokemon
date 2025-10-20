<?php
// /api/redeem.php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // 若你要跨域使用，可留著
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// ✅ Supabase 參數
$SUPABASE_URL = "https://fsglwszioporinflhcuk.supabase.co";
$SUPABASE_KEY = "'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzZ2x3c3ppb3BvcmluZmxoY3VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0NzI5ODEsImV4cCI6MjA3NjA0ODk4MX0.dhaiVLec5_C5qDzWG3GJ0bbXKrH0E0QyQUN8Q9fcCGk'";

// ✅ 取得輸入代碼
$input = json_decode(file_get_contents("php://input"), true);
$p_code = $input['p_code'] ?? '';

if (!$p_code) {
  echo json_encode(["error" => "缺少抽獎代碼"]);
  exit;
}

// ✅ 呼叫 Supabase RPC
$rpcUrl = "$SUPABASE_URL/rest/v1/rpc/redeem_code";

$ch = curl_init($rpcUrl);
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => [
    "Content-Type: application/json",
    "apikey: $SUPABASE_KEY",
    "Authorization: Bearer $SUPABASE_KEY"
  ],
  CURLOPT_POSTFIELDS => json_encode(["p_code" => $p_code])
]);

$response = curl_exec($ch);
$httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// ✅ 回傳結果
echo $response ?: json_encode(["error" => "RPC 連線失敗", "http" => $httpcode]);
