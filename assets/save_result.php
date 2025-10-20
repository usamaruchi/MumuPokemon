<?php
// /api/save_result.php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

$SUPABASE_URL = "https://fsglwszioporinflhcuk.supabase.co";
$SUPABASE_KEY = "'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzZ2x3c3ppb3BvcmluZmxoY3VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0NzI5ODEsImV4cCI6MjA3NjA0ODk4MX0.dhaiVLec5_C5qDzWG3GJ0bbXKrH0E0QyQUN8Q9fcCGk'";
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
