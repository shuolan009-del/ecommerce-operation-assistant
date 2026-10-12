# 电商运营助手 · 前端优化第一刀

## 做了什么

| 项 | 文件 | 改动 |
|---|---|---|
| 修 bug | `web/src/app/products/[id]/creative-plans/[planId]/main-image/update/route.ts` | +1 行 |
| 修 bug | `web/src/app/products/[id]/creative-plans/[planId]/video-script/update/route.ts` | +1 行 |
| 新增 | `web/src/app/products/[id]/loading.tsx` | 骨架屏 |

## Bug 详情

两处 route handler 为拿 plan 旧内容，各自 GET 了一次商品详情，但**漏传 `authHeaders()`**：

```diff
 const productResponse = await fetch(`${API_BASE_URL}/api/v1/products/${id}`, {
+  headers: await authHeaders(),
   cache: "no-store",
 });
```

后端 `get_product` 依赖链 `require_view_permission` → `get_current_user` → `_bearer_token()`，
缺 `Authorization` 直接 401，于是 `!productResponse.ok` 成立，
**主图编辑与视频脚本编辑保存必然跳 `?edit=failed`**。

同目录 `diagnoses/[diagnosisId]/update/route.ts` 做同样 GET 但带了 authHeaders，可作对照。

## loading.tsx

骨架贴合真实首屏栅格：面包屑标题 → 卖点 + 3 指标卡 → 10 个 tab → 工作流 4 步 → 左表单右表格，
用 `animate-pulse`。侧栏/顶栏由 layout 渲染，不被骨架吞掉。

## 验证结果

- `tsc --noEmit` ✅ 0 错误
- `eslint src` ✅ 0 告警
- `next build` ✅ 通过，0 error / 0 warning
- CDP 真机验证 ✅ **6/6 通过**
  - 客户端导航时骨架渲染 **57 个块**，持续约 6s（覆盖后端延迟窗口）
  - 10 个 tab 占位齐全、工作流面板在位
  - 无横向溢出
  - 加载完成后骨架归零（正确卸载，非常驻假骨架）
  - 0 个 JS 未捕获异常

证据：`web/docs/verify/01-loading-skeleton.png`、`02-after-load.png`、`loading-timeline.json`

## 重要认知修正

**`loading.tsx` 不是 SSR 流式占位。** 实测慢后端下 `TTFB = 6.02s`，
HTML 在 RSC 就绪前一字节不吐 —— 首屏直连时骨架**不会出现**。
它只在**客户端路由跳转**时作为过渡态渲染。

验证方法因此必须是：假后端（列表秒回 / 详情延迟 6s）+ 真实 `<a>` 点击 + CDP 密集采样。
直连采样会误判成「组件没生效」。

## 环境坑

`NODE_OPTIONS` 带 `--use-system-ca` 会让 `next build` 直接崩：
`ERR_WORKER_INVALID_EXEC_ARGV`。与代码无关，跑构建前 `NODE_OPTIONS= npx next build`。

## 后续（未动，待确认）

- 第二刀：抽 `lib/formatters.ts` 与 `lib/content-readers.ts`，`page.tsx` 3271 → ~2000 行
- 第三刀：按 tab 拆 `products/[id]/_sections/`
- 可选：补 `app/error.tsx`、`lib/api.ts` 异常策略统一、echarts 按需引入
