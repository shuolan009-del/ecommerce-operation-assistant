# AI电商运营助手（ecommerce-operation-assistant）

基于 LangGraph 多智能体的电商商品运营平台：输入商品与经营数据，自动完成
「上下文采集 → 经营诊断 → 创意生成（主图 / 视频脚本）→ 质量审核」全流程，
关键节点带人工审批门禁（通过 / 驳回可回退）。

## 系统组成

| 服务 | 目录 | 说明 | 端口 |
|---|---|---|---|
| api | `api/` | FastAPI 后端 + LangGraph 多智能体 | 8000 |
| worker | `api/`（同镜像） | Celery 异步任务（generation / agent / agent.workflow / maintenance 队列） | — |
| web | `web/` | Next.js（App Router）前端 | 3000 |

基础设施由 `docker-compose.yml` 一键编排：MySQL 8.4（业务库）、Redis 7（Celery broker）、
Postgres 16（LangGraph agent checkpoint）。

## 核心特性

- **四智能体工作流**：context（上下文采集）→ diagnosis（经营诊断）→
  creative（创意生成）→ quality（质量审核），`human_review_gate` 人工审批门禁。
- **多模态生成**：商品主图、视频脚本 / 视频生成；provider 可切换
  （dashscope / siliconflow / alibaba 等），内置轮询等待与重试。
- **业务域**：商品、店铺、SKU 库存、推广链接、广告实验、创意计划、经营诊断、趋势看板。
- **模型设置**：LLM / 图像 / 视频三套 `base_url + api_key + model` 可在界面配置并测试。

## 快速开始

```bash
# 1. 配置环境变量（.env.example 含全部变量说明）
cp .env.example .env      # 填写 MySQL/Redis/Postgres 密码与各家模型 Key

# 2. 一键起全部服务（api 启动时自动执行 alembic upgrade head）
docker compose up -d --build

# 前端 http://127.0.0.1:3000    后端文档 http://127.0.0.1:8000/docs
```

本地开发（不走 Docker）：

```bash
cd api && uv sync && alembic upgrade head
uv run uvicorn app.main:app --reload --port 8000
# 另开终端：celery -A app.worker.celery_app.celery_app worker -Q generation,agent,agent.workflow,maintenance -B
cd web && npm install && npm run dev
```

## 目录结构

```
api/
  app/agents/      LangGraph 多智能体（graph / registry / specialists / policy / tool_gateway …）
  app/api/routes/  认证、商品、店铺、库存、推广链接、模型设置、智能体运行等路由
  app/services/    广告实验、图像/视频生成（dashscope / siliconflow）等服务
  alembic/         数据库迁移
web/               Next.js 前端（App Router，含趋势看板）
docker-compose.yml 全栈编排（mysql / redis / postgres / api / worker / web）
```

## 测试

> 单元测试代码已在 2026-10-14 仓库瘦身中移除（运行时不依赖）；如需恢复，见 git 历史中的 `api/tests/`。
