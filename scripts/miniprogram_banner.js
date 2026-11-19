/*
 * 多人签 首页 banner 清空
 * 命中: https://xxtpy.lovegcu.xyz/api/home/content
 *
 * 响应结构:
 *   { code:0, message:"", data:{ notice:"", banners:[{id,imgUrl,link,sort}] } }
 *
 * 策略: 只把 banners 置空数组，保留 data 结构。
 * 不删除 data.banners 字段 —— 前端若读 .length 或 .map 会直接报错白屏。
 */
var body = $response.body;

try {
  var obj = JSON.parse(body);

  if (!obj || typeof obj !== "object") {
    $done({});
  } else if (obj.data && Array.isArray(obj.data.banners)) {
    obj.data.banners = [];
    $done({ body: JSON.stringify(obj) });
  } else if (obj.data && obj.data.banners === undefined) {
    // 本来就没有 banner 字段，补一个空数组，避免前端 undefined
    obj.data.banners = [];
    $done({ body: JSON.stringify(obj) });
  } else {
    $done({});
  }
} catch (e) {
  // 不是合法 JSON，原样放行
  $done({});
}
