# 海湾对白与前期引导验收 · 2026-10-01

## 本批范围

仅本地修订，不部署，不新增账号凭据或平台权限。用户批准仅本机 127.0.0.1:5234/5236 预览。保留原 `.data/preview.sqlite`；新 UI 验收使用应用浏览器的独立本地访客记录，没有修改历史玩家进度。

## 通过

- 27 项 Node 测试、TypeScript/Vite 构建、UI 基础审计通过。四项新增测试覆盖知识前提、阅读恢复/语言/旅程/人物隔离、前期自由问答准入/失败无消费、所有介绍的双语分页完整性。
- 实际 UI 按顺序走三页序章 → 接近玛拉 → 介绍 → 阅读完成 → 自由提问。第一次请求发生在领取钥匙前；没有绕过主线进度。
- 真实中文问题：“我一个人刚到这里，有点紧张。你第一次搬来时是怎么慢慢熟悉这里的？”收到结合初来小镇的回答。
- 真实英文追问：“What was your first afternoon here like? Tell me two small things you did to feel more at home, and what I could try today.” 收到两页回复。
- 英文回复第二页关闭/重开及刷新/重开，仍为 Reply 2 / 2。观察网络请求，恢复期间 `/action` 请求数为 0（事件无截断）。人物窗口没有提前显示后续话题。
- 未读中文回复切换英文，恢复同一回执的英文第一页。完成自由提问后不再显示首次邀请，保留追问与作者话题。
- 浏览器拦截一次发送请求，问题草稿保留；移除拦截并刷新后，同一 pending envelope 恢复成功，草稿清空，真实回复可读。未清除存档或伪造成功记录。
- 另拦截一次领取钥匙，界面显示直接恢复按钮并禁止发新动作；解除拦截后点恢复，收到钥匙，目标改为回住处放行李。
- 对话提交时模拟网络延迟，立即关闭并打开菜单；回复到达后仍保留菜单，重新接近人物可读回复。
- 实测 viewport 390×844 与 320×568，无横向溢出。应用浏览器普通截图会缩成面板缩略图，验收使用 CDP 实际 CSS 视口截图；文档与图片尺寸一致。

## 证据

- `_qa/dialogue-opening-platform-layout-390.png`：序章第二步。
- `_qa/dialogue-invitation-platform-layout-390.png`：首次自由提问与领取钥匙。
- `_qa/dialogue-reply-platform-layout-320.png`：英文真实回答。
- `_qa/dialogue-followup-platform-layout-320.png`：成功后的追问界面。

主验收仅通过浏览器 QA 临时样式隐藏外部 guest banner；正式源码仍加载该脚本。断网/延迟模拟均已解除。

## 未完成/不能外推

- 真实 AlterU 账号绑定、同账号两个独立设备续玩、账号切换/登出隔离尚未通过。其他测试中的 owner-a/owner-b 或浏览器 cookie 不等于真实账号。
- 当前运行存储是本地 SQLite，不能据此宣称本作 PG/生产运行通过。
- 新玩家理解为 comprehension unverified；本轮没有用户亲自试玩或真实 iPhone 听感/连续性能证据。
- 未把账号接入写成已验证技能，旧技能冲突和可复用代理边界记录在 `doc/account-storage-integration.md`。
