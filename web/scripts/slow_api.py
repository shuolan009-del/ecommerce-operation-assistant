"""验证 products/[id]/loading.tsx 用的假后端。

分工：
  GET /api/v1/products      → 立即返回一条商品，让首页渲染出可点击的链接
  其他所有接口              → 延迟 6 秒后返回 401，制造客户端导航的加载窗口

这样从首页点进详情就会走 Next 的客户端路由，loading.tsx 才会出现
（SSR 直连不会流式输出骨架，实测 TTFB 等于后端耗时）。
"""
import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DELAY_SECONDS = 6

FAKE_PRODUCTS = [
    {
        "id": 1,
        "name": "骨架验证用测试商品",
        "platform": "douyin",
        "price": "99.00",
        "store_id": 1,
        "category": "验证",
        "selling_points": ["加载态验证"],
    }
]


class Handler(BaseHTTPRequestHandler):
    def _json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?")[0]

        # 商品列表：秒回，让首页有链接
        if path == "/api/v1/products":
            self._json(200, FAKE_PRODUCTS)
            return

        # 店铺列表：秒回，避免首页因店铺缺失报错
        if path == "/api/v1/stores":
            self._json(200, [])
            return

        # 其余（详情、实验看板、Agent 记录等）：延迟，制造加载窗口
        time.sleep(DELAY_SECONDS)
        self._json(401, {"detail": "Missing auth token"})

    do_POST = do_GET
    do_PATCH = do_GET

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8901), Handler)
    print(f"slow_api listening on 8901, delay={DELAY_SECONDS}s", flush=True)
    server.serve_forever()
