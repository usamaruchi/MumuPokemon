<?php
// /api/redeem.php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // 若你要跨域使用，可留著
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// ✅ Supabase 參數
$SUPABASE_URL = "https://fsglwszioporinflhcuk.supabase.co";
$SUPABASE_KEY = "你的_key_放這裡";

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
