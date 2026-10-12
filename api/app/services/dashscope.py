"""阿里云百炼（DashScope / Model Studio）通用请求工具。

图片与视频生成服务共用这一层，集中处理：
- Bearer 鉴权头与异步任务头（``X-DashScope-Async``）；
- 同步接口调用与异步任务提交；
- 任务轮询（``GET /api/v1/tasks/{task_id}``）；
- 供应商错误解析（OpenAI 风格 ``{"error": {...}}`` 与百炼风格 ``{"code": ..., "message": ...}``）；
- 结果 URL / base64 的容错提取。

这样图片与视频两个服务不必各自复制一套 HTTP 与解析逻辑。
"""

from __future__ import annotations

import time
from typing import Any
from urllib.parse import urlsplit, urlunsplit

import httpx


class AlibabaAPIError(RuntimeError):
    """百炼接口返回错误或网络失败时抛出，消息保留供应商原文便于排障。"""


def build_headers(api_key: str, *, async_call: bool = False) -> dict[str, str]:
    """构造请求头；异步任务必须携带 ``X-DashScope-Async: enable``。"""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    if async_call:
        headers["X-DashScope-Async"] = "enable"
    return headers


def post_json(
    url: str,
    *,
    api_key: str,
    payload: dict[str, Any],
    timeout: int,
    async_call: bool = False,
) -> dict[str, Any]:
    """发送 JSON POST 请求并解析响应，HTTP 错误或业务错误统一转成 AlibabaAPIError。"""
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            response = client.post(
                url,
                headers=build_headers(api_key, async_call=async_call),
                json=payload,
            )
    except httpx.HTTPError as exc:
        raise AlibabaAPIError(f"DashScope request failed: {type(exc).__name__}: {exc}") from exc
    return _parse_response(response)


def get_json(url: str, *, api_key: str, timeout: int) -> dict[str, Any]:
    """发送 GET 请求并解析响应，用于轮询异步任务结果。"""
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            response = client.get(url, headers=build_headers(api_key))
    except httpx.HTTPError as exc:
        raise AlibabaAPIError(f"DashScope request failed: {type(exc).__name__}: {exc}") from exc
    return _parse_response(response)


def tasks_url(base_url: str, task_id: str) -> str:
    """由配置的 base_url 推导异步任务查询地址。

    例如 ``https://host/compatible-mode/v1`` -> ``https://host/api/v1/tasks/{task_id}``。
    """
    parts = urlsplit((base_url or "").rstrip("/"))
    path = parts.path
    for suffix in ("/compatible-mode/v1", "/api/v1"):
        if path.endswith(suffix):
            path = path[: -len(suffix)]
            break
    return urlunsplit((parts.scheme, parts.netloc, f"{path}/api/v1/tasks/{task_id}", "", ""))


def poll_task(
    base_url: str,
    *,
    api_key: str,
    task_id: str,
    interval_seconds: int,
    max_attempts: int,
    timeout: int = 30,
) -> dict[str, Any]:
    """轮询异步任务直到出现结果 URL/结束状态或超时。"""
    url = tasks_url(base_url, task_id)
    attempts = max(max_attempts, 1)
    interval = max(interval_seconds, 1)
    for _ in range(attempts):
        data = get_json(url, api_key=api_key, timeout=timeout)
        status = extract_task_status(data)
        if extract_result_url(data) or extract_b64_result(data):
            return data
        if status in {"FAILED", "CANCELED", "CANCELLED", "EXPIRED", "UNKNOWN"}:
            raise AlibabaAPIError(f"DashScope task ended with status: {status} :: {_brief(data)}")
        time.sleep(interval)
    raise AlibabaAPIError(f"DashScope task timed out after {attempts} polls.")


def extract_task_id(data: dict[str, Any]) -> str:
    """从多种响应结构中提取任务 ID。"""
    for container in _iter_containers(data):
        value = container.get("task_id")
        if isinstance(value, str) and value:
            return value
    return ""


def extract_task_status(data: dict[str, Any]) -> str:
    """提取并归一化任务状态（大写），无状态时返回空串。"""
    for container in _iter_containers(data):
        value = container.get("task_status") or container.get("status")
        if isinstance(value, str) and value:
            return value.upper()
    return ""


def extract_result_url(data: dict[str, Any]) -> str:
    """容错提取结果资源 URL（图片或视频），兼容百炼与 OpenAI 两种响应结构。"""
    for container in _iter_containers(data):
        for key in ("url", "image_url", "video_url"):
            value = container.get(key)
            if isinstance(value, str) and value:
                return value
        for key in ("image_urls", "video_urls", "urls", "result_urls"):
            value = container.get(key)
            if isinstance(value, list) and value and isinstance(value[0], str) and value[0]:
                return value[0]
        results = container.get("results")
        if isinstance(results, list) and results:
            first = results[0]
            if isinstance(first, str) and first:
                return first
            if isinstance(first, dict):
                for key in ("url", "image_url", "video_url"):
                    value = first.get(key)
                    if isinstance(value, str) and value:
                        return value
    return ""


def extract_b64_result(data: dict[str, Any]) -> str:
    """容错提取 base64 结果（供应商可能直接返回图片字节）。"""
    for container in _iter_containers(data):
        value = container.get("b64_json")
        if isinstance(value, str) and value:
            return value
        results = container.get("results")
        if isinstance(results, list) and results:
            first = results[0]
            if isinstance(first, str) and first.startswith("data:"):
                return first
            if isinstance(first, dict):
                value = first.get("b64_json")
                if isinstance(value, str) and value:
                    return value
    return ""


def _iter_containers(data: dict[str, Any]) -> list[dict[str, Any]]:
    """把 ``output`` / ``data`` 下的字典或字典列表统一展开成可遍历的容器序列。"""
    containers: list[dict[str, Any]] = []
    for key in ("output", "data"):
        value = data.get(key)
        if isinstance(value, dict):
            containers.append(value)
        elif isinstance(value, list):
            containers.extend(item for item in value if isinstance(item, dict))
    containers.append(data)
    return containers


def _parse_response(response: httpx.Response) -> dict[str, Any]:
    """解析响应体；HTTP 4xx/5xx 或内嵌错误对象都转成 AlibabaAPIError。"""
    try:
        data = response.json()
    except ValueError:
        data = {"_raw": response.text[:500]}
    if response.status_code >= 400:
        raise AlibabaAPIError(
            f"DashScope HTTP {response.status_code}: {_error_message(data) or _brief(data)}"
        )
    if isinstance(data, dict):
        message = _error_message(data)
        if message:
            raise AlibabaAPIError(f"DashScope error: {message}")
        return data
    raise AlibabaAPIError(f"DashScope response was not a JSON object: {_brief(data)}")


def _error_message(data: Any) -> str:
    """从 OpenAI 风格或百炼风格错误体中取出可读消息。"""
    if not isinstance(data, dict):
        return ""
    error = data.get("error")
    if isinstance(error, dict):
        message = error.get("message") or error.get("code")
        if isinstance(message, str) and message:
            return message
    if isinstance(error, str) and error:
        return error
    if data.get("code") and data.get("code") not in (0, "0", "Success", "success"):
        message = data.get("message")
        if isinstance(message, str) and message:
            return f"{data.get('code')}: {message}"
        return str(data.get("code"))
    return ""


def _brief(data: Any) -> str:
    """截断响应内容，避免把超长 body 写进任务错误字段。"""
    return str(data)[:500]
