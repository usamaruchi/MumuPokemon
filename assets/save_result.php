<?php
// /api/save_result.php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

$SUPABASE_URL = "https://fsglwszioporinflhcuk.supabase.co";
$SUPABASE_KEY = "你的_key_放這裡";
$TABLE = "random_logs";

$input = json_decode(file_get_contents("php://input"), true);
if (!$input) {
  echo json_encode(["error" => "缺少資料"]);
  exit;
}

// ✅ 發送至 Supabase REST API
$url = "$SUPABASE_URL/rest/v1/$TABLE";

$ch = curl_init($url);
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => [
    "Content-Type: application/json",
    "apikey: $SUPABASE_KEY",
    "Authorization: Bearer $SUPABASE_KEY",
    "Prefer: return=minimal"
  ],
  CURLOPT_POSTFIELDS => json_encode($input)
]);

$response = curl_exec($ch);
$httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// ✅ 回傳結果
if ($httpcode >= 200 && $httpcode < 300) {
  echo json_encode(["success" => true]);
} else {
  echo json_encode(["error" => "寫入失敗", "status" => $httpcode, "body" => $response]);
}
