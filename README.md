# 微信小程序去广告 Pro（Loon）

模仿 `kelee.one` 的 `WexinMiniPrograms_Remove_ads.lpx` 重做的一版，并按 PC 端实抓结果做了增量。

`.lpx` 就是 `.plugin` 改了扩展名，两者格式完全相同 —— Loon 只认内容不认后缀。

## 文件

| 文件 | 作用 |
|---|---|
| `WeChatMiniProgram_Ads.lpx` | 插件本体，导入 Loon 即用 |
| `tools/mitm_proxy.py` | PC 端 MITM 抓包代理（按域名动态签证书，只记录不改包） |
| `tools/sniff_proxy.py` | 轻量探针，只记域名不解密，用来确认客户端走不走系统代理 |
| `tools/gen_rules.py` | 抓包 URL 列表 → 自动生成 `[Rewrite]` / `[MitM]` 片段 |
| `tools/build_lpx.py` | 上游规则 + 本仓增量 → 重新合成 `.lpx`，带 MitM 覆盖率校验 |
| `serve/serve.py` | 局域网分发插件给手机（电脑和手机不同网时用不上） |
| `examples/sample_cap.txt` | `gen_rules.py` 的输入样例 |

## 当前结构

```
[Rule]     19 条    域名层，不需要 MitM，命中即断
[Rewrite] 108 条    接口层，需要 MitM
[Script]   15 条    默认全部注释
[MitM]     87 hosts
```

## 「多人签」——已实抓，不是猜的

2026-11-19 在 PC 端微信 4.0 里抓的完整流量，结论：

**只有一个广告位**：首页轮播。接口 `https://xxtpy.lovegcu.xyz/api/home/content`
返回 `data.banners` 数组（4 条，图指向 `p.ananas.chaoxing.com`）。

处理方式不是整条 reject，而是只清空数组：

```
^https:\/\/xxtpy\.lovegcu\.xyz\/api\/home\/content response-body-json-replace data.banners []
```

**为什么不用 reject-dict**：小程序代码很可能直接读 `data.banners.length`，
返回 `{}` 会让 `data` 变 undefined 导致首页报错。保留结构只清数组最安全。

**业务接口不可拦**（拦了白屏）：

```
/api/auth/login  /api/auth/refresh  /api/auth/school
/api/me/points   /api/notes/avatar
/api/courses/list  /api/shuake/catalog
```

**另一个增量**：`wxsmw.wxs.qq.com` —— 微信激励视频广告素材域名，
路径形如 `/131/20210/snssvpdownload/SH/reserved/ads_svp_video__xxx.mp4`。
上游插件没有这条，已加到 `[Rule]` 整域拦截。

## PC 端抓包流程（可复用到任何小程序）

前提：电脑有 openssl（Git Bash 自带）、微信 PC 版能开小程序。

1. **起代理**

```bash
python tools/mitm_proxy.py 8080
```

2. **导入 CA 到受信任根**（只做一次）

```powershell
$c = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2("certs\ca.crt")
$s = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root","CurrentUser")
$s.Open("ReadWrite"); $s.Add($c); $s.Close()
```

3. **系统代理指向它**

```powershell
$k="HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings"
Set-ItemProperty $k -Name ProxyEnable -Value 1 -Type DWord
Set-ItemProperty $k -Name ProxyServer  -Value "127.0.0.1:8080" -Type String
```

4. **完全退出微信再重开**（不重开不读新代理），进小程序把广告逼出来
5. **看 `logs/traffic.log`**，`[AD?]` 标记的是命中广告关键词的请求
6. **撤代理**：`ProxyEnable = 0`

注意事项：

- 抓包期间全系统流量都过这个代理。只记 URL、不改包，但别登网银。
- 日志含 `uin` / `key` / `pass_ticket` 这类凭证，分析完记得脱敏再留存。
- CA 私钥在 `certs/ca.key`，**抓包结束建议卸载 CA**：
  `Get-ChildItem Cert:\CurrentUser\Root | ? { $_.Subject -like "*LoonDebug*" } | Remove-Item`
- 微信若走 QUIC（HTTP/3）会绕过 HTTP 代理，此时需在防火墙拦 UDP 443 再试。

## 排障

| 现象 | 原因 | 处理 |
|---|---|---|
| 装了没反应 | 没开 MitM / 证书没信任 / 小程序没重启 | 三样按顺序查 |
| 小程序一直转圈 | `reject` 断了业务接口 | 注释最近加的规则二分定位 |
| 白屏 | `reject-dict` 给了 `{}` 但代码在读字段 | 换 `response-body-json-replace` 只改字段 |
| 首页图片全挂 | `DOMAIN-SUFFIX` 误伤 CDN 主域 | 收窄成 `DOMAIN,` |
| 支付/登录报错 | `e.qq.com` 或统计域名拦过头 | 注释 `[Rule]` 对应行 |

## 维护

小程序改版 → 接口路径变 → 规则失效。这是这个品类的固有成本。

`build_lpx.py` 把「上游规则集」和「自己抓的规则」分开管：
换掉 `ref_plugin.txt` 重跑，自己的增量不会被覆盖。

## 来源

`[Rewrite]` 主体来自可莉（iKeLee）的公开插件，条目保留原作者标注
（@可莉 / @张军 / @ArthasYZ / @TEAXS / @Keywos / @jinlvei）。

本仓增量：广告 SDK 域名层（广点通 / 穿山甲 / 百度联盟 / **微信激励视频素材**）、
多人签实抓规则、激进模式兜底、PC 端抓包工具链。
