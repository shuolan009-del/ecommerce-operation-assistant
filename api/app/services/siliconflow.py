"""硅基流动（SiliconFlow）通用请求工具。

集中处理：
- ``POST /v1/images/generations`` 文生图（返回 ``{"images":[{"url":...}]}``）；
- ``POST /v1/video/submit`` 视频任务提交（返回 ``{"requestId": ...}``）；
- ``POST /v1/video/status`` 视频任务轮询；
- 错误解析（``{"code":..., "message":...}`` 与 OpenAI 风格 ``{"error":{...}}``）；
- 分辨率写法归一化（``1024*1024`` -> ``1024x1024``）。

图片与视频服务共用这一层，避免各自复制 HTTP 与解析逻辑。
"""

from __future__ import annotations

import time
from typing import Any

import httpx


class SiliconflowAPIError(RuntimeError):
    """硅基流动接口返回错误或网络失败时抛出，消息保留供应商原文便于排障。"""


def normalize_size(size: str | None, default: str = "1024x1024") -> str:
    """把 ``1024*1024`` 归一化为硅基流动要求的 ``1024x1024``。"""
    value = (size or "").replace("*", "x").replace("X", "x").strip()
    return value or default


def post_json(url: str, *, api_key: str, payload: dict[str, Any], timeout: int) -> dict[str, Any]:
    """发送 JSON POST 请求并解析响应，HTTP 或业务错误统一转成 SiliconflowAPIError。"""
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            response = client.post(
                url,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
    except httpx.HTTPError as exc:
        raise SiliconflowAPIError(f"SiliconFlow request failed: {type(exc).__name__}: {exc}") from exc
    return _parse_response(response)


def submit_video(base_url: str, *, api_key: str, payload: dict[str, Any], timeout: int = 60) -> str:
    """提交视频生成任务，返回 requestId。"""
    data = post_json(_join(base_url, "/video/submit"), api_key=api_key, payload=payload, timeout=timeout)
    request_id = data.get("requestId") or data.get("request_id")
    if not isinstance(request_id, str) or not request_id:
        raise SiliconflowAPIError(f"SiliconFlow video submit did not return requestId: {str(data)[:300]}")
    return request_id


def poll_video(
    base_url: str,
    *,
    api_key: str,
    request_id: str,
    interval_seconds: int,
    max_attempts: int,
    timeout: int = 30,
) -> dict[str, Any]:
    """轮询视频任务直到成功、失败或超时。"""
    url = _join(base_url, "/video/status")
    attempts = max(max_attempts, 1)
    interval = max(interval_seconds, 1)
    for _ in range(attempts):
        data = post_json(url, api_key=api_key, payload={"requestId": request_id}, timeout=timeout)
        status = str(data.get("status") or "").strip().lower()
        if extract_video_url(data):
            return data
        if status in {"failed", "error", "canceled", "cancelled"}:
            raise SiliconflowAPIError(f"SiliconFlow video task ended with status: {status} :: {str(data)[:300]}")
        time.sleep(interval)
    raise SiliconflowAPIError(f"SiliconFlow video task timed out after {attempts} polls.")


def extract_image_url(data: dict[str, Any]) -> str:
    """从响应中提取图片 URL（兼容 ``images[]`` 与 OpenAI 风格 ``data[]``）。"""
    for key in ("images", "data"):
        items = data.get(key)
        if isinstance(items, list) and items:
            first = items[0]
            if isinstance(first, dict):
                value = first.get("url")
                if isinstance(value, str) and value:
                    return value
            elif isinstance(first, str) and first:
                return first
    return ""


def extract_image_b64(data: dict[str, Any]) -> str:
    """提取 base64 图片内容（若供应商直接返回字节）。"""
    for key in ("images", "data"):
        items = data.get(key)
        if isinstance(items, list) and items and isinstance(items[0], dict):
            value = items[0].get("b64_json")
            if isinstance(value, str) and value:
                return value
    return ""


def extract_video_url(data: dict[str, Any]) -> str:
    """从状态响应中提取视频 URL（``results.videos[0].url`` 等）。"""
    containers: list[dict[str, Any]] = []
    results = data.get("results")
    if isinstance(results, dict):
        containers.append(results)
    containers.append(data)
    for container in containers:
        for key in ("videos", "data"):
            items = container.get(key)
            if isinstance(items, list) and items:
                first = items[0]
                if isinstance(first, dict):
                    value = first.get("url")
                    if isinstance(value, str) and value:
                        return value
                elif isinstance(first, str) and first:
                    return first
        value = container.get("url")
        if isinstance(value, str) and value:
            return value
    return ""


def _parse_response(response: httpx.Response) -> dict[str, Any]:
    """解析响应体；HTTP 4xx/5xx 或内嵌错误对象都转成 SiliconflowAPIError。"""
    try:
        data = response.json()
    except ValueError:
        data = {"_raw": response.text[:500]}
    if response.status_code >= 400:
        raise SiliconflowAPIError(
            f"SiliconFlow HTTP {response.status_code}: {_error_message(data) or str(data)[:300]}"
        )
    if isinstance(data, dict):
        message = _error_message(data)
        if message:
            raise SiliconflowAPIError(f"SiliconFlow error: {message}")
        return data
    raise SiliconflowAPIError(f"SiliconFlow response was not a JSON object: {str(data)[:300]}")


def _error_message(data: Any) -> str:
    """从 ``{"code","message"}`` 或 ``{"error":{...}}`` 中取出可读消息。"""
    if not isinstance(data, dict):
        return ""
    error = data.get("error")
    if isinstance(error, dict):
        message = error.get("message") or error.get("code")
        if isinstance(message, str) and message:
            return message
    if isinstance(error, str) and error:
        return error
    code = data.get("code")
    if code not in (None, 0, "0", 200, "200", "Success", "success"):
        message = data.get("message")
        if isinstance(message, str) and message:
            return f"{code}: {message}"
        return str(code)
    return ""


def _join(base_url: str, path: str) -> str:
    """拼接 base_url 与路径，容忍重复/缺失的斜杠。"""
    return (base_url or "").rstrip("/") + path
