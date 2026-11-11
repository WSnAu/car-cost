# 车账本 — 个人交通费记录（iPhone 可用的网页 App）

记录加油、保险、高速费、保养维修、停车、洗车、顺风车收入等，自动计算油耗（加满法），按月/年统计。
数据只保存在手机本地，可离线使用，支持 JSON 备份恢复与 CSV（Excel）导出。

## 一、在电脑上预览

在本目录打开 PowerShell：

```bash
python -m http.server 8000
```

浏览器打开 http://localhost:8000 ，按 F12 切换到手机视图即可预览。

## 二、发布到网上（GitHub Pages，免费）

iPhone 安装网页 App 需要 https 地址，用 GitHub Pages 最简单：

1. 注册 https://github.com 账号。
2. 右上角 “+” → New repository，名称填 `car-cost`，选 **Public**，创建。
3. 在仓库页面点 “uploading an existing file”，把本目录下的 **所有文件和文件夹**（index.html、manifest.json、sw.js、css、js、icons）拖进去，点 Commit changes。
4. 仓库 Settings → Pages → Branch 选 `main`、目录 `/ (root)` → Save。
5. 一两分钟后得到网址：`https://你的用户名.github.io/car-cost/`

> 网址公开，但里面只有程序，没有你的数据；数据只存在你自己的手机里。

## 三、安装到 iPhone

1. 用 **Safari** 打开上面的网址。
2. 点底部 “分享” 按钮 → “添加到主屏幕” → 添加。
3. 以后从主屏幕图标打开，全屏运行，断网也能用。

## 四、使用说明

- **加油**：填单价、升数、金额中的任意两项，第三项自动算出；必须填里程表读数；加满时勾选“本次加满”。
- **油耗**：两次“加满”之间的加油量 ÷ 行驶里程 × 100。中途没加满的记录会累计到下一次加满。
- **编辑/删除**：在“明细”里点某条记录。
- **备份**：设置 → 导出备份，手机上会弹出分享面板，选“存储到文件”（可存到 iCloud 云盘）。换手机或数据丢失时用“从备份恢复”。

> ⚠️ 数据保存在 Safari 网页存储中。删除主屏图标或清除 Safari 网站数据会丢失记录，请每月导出一次备份。

## 五、更新程序

修改代码后重新上传到 GitHub 覆盖原文件，并把 `sw.js` 第一行的 `car-cost-v1` 改成 `v2`、`v3`…，手机上重新打开 App 一两次即可更新。数据不受影响。

## 文件说明

| 文件 | 作用 |
|---|---|
| index.html | 页面结构 |
| css/style.css | 样式（支持深色模式） |
| js/app.js | 界面逻辑 |
| js/db.js | 本地数据库（IndexedDB） |
| js/fuel.js | 油耗计算 |
| js/stats.js | 统计与图表 |
| js/backup.js | 备份导入导出 |
| js/types.js | 费用类型定义（可在此增加类型） |
| sw.js | 离线缓存 |
| manifest.json | 主屏幕 App 配置 |
