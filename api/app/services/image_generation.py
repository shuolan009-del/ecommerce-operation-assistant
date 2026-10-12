import base64
import time
import uuid
import json
from typing import Any

import httpx

from app.core.config import API_DIR, Settings
from app.models import CreativePlan, CreativePlanType
from app.services import dashscope, siliconflow
from app.services.model_settings import get_runtime_settings
from app.services.volcengine import VolcengineCredentialsError, parse_access_key_pair, signed_json_headers


class ImageGenerationNotConfiguredError(RuntimeError):
    pass


class ImageGenerationError(RuntimeError):
    pass


UPLOADS_DIR = API_DIR / "uploads"
GENERATED_IMAGES_DIR = UPLOADS_DIR / "generated"


def is_image_generation_configured(settings: Settings | None = None) -> bool:
    """判断图片生成任务configured；集中执行业务校验、状态变更与持久化，并返回可验证结果。"""
    settings = settings or get_runtime_settings()
    return bool(
        settings.image_provider
        and settings.image_base_url
        and settings.image_api_key
        and settings.image_model
    )


def generate_main_image_asset(
    creative_plan: CreativePlan,
    *,
    settings: Settings | None = None,
) -> dict[str, Any]:
    """生成主流程图片素材；集中执行业务校验、状态变更与持久化，并返回可验证结果。"""
    # 按“输入归一化 → 业务校验 → 状态或持久化”推进，异常不得留下半完成结果。
    settings = settings or get_runtime_settings()
    if not is_image_generation_configured(settings):
        raise ImageGenerationNotConfiguredError("Image generation provider is not configured.")
    if creative_plan.type != CreativePlanType.MAIN_IMAGE:
        raise ImageGenerationError("Only main image plans can generate image assets.")

    # 生成前清洗 prompt，减少不可见字符和特殊货币符号导致供应商接口解析失败的概率。
    prompt = _sanitize_image_prompt(_main_image_prompt(creative_plan))

    provider = (settings.image_provider or "").lower()
    if provider == "jimeng":
        if settings.image_model != "jimeng_t2i_v30":
            raise ImageGenerationNotConfiguredError("本章图片模型必须为 jimeng_t2i_v30。")
        task_id = _create_jimeng_image_task(prompt, settings)
        result = _poll_jimeng_image_task(task_id, settings)
        image_url = _extract_jimeng_image_url(result)
        public_path = _download_generated_image(image_url, creative_plan.id)
    elif provider.startswith("alibaba") or provider == "dashscope":
        # 百炼（qwen-image 等）走兼容模式 images/generations，返回 URL 或 base64 后落盘。
        task_id, public_path, image_url = _generate_alibaba_image(prompt, creative_plan, settings)
    elif _is_siliconflow_provider(provider):
        # 硅基流动（Tongyi-MAI/Z-Image-Turbo 等）同步返回 {"images":[{"url":...}]}。
        task_id, public_path, image_url = _generate_siliconflow_image(prompt, creative_plan, settings)
    else:
        raise ImageGenerationNotConfiguredError(
            f"Unsupported image provider: {settings.image_provider}"
        )

    return {
        "provider": settings.image_provider,
        "model": settings.image_model,
        "size": settings.image_size,
        "prompt": prompt,
        "task_id": task_id,
        "source_url": image_url,
        "url": public_path,
        "created_at": int(time.time()),
    }


def _create_jimeng_image_task(prompt: str, settings: Settings) -> str:
    """创建jimeng图片任务，统一主流程中的格式、默认值和异常边界。"""
    # 按“输入归一化 → 业务校验 → 状态或持久化”推进，异常不得留下半完成结果。
    width, height = _parse_image_size(settings.image_size)
    payload: dict[str, Any] = {
        "req_key": settings.image_model,
        "prompt": prompt,
        "use_pre_llm": True,
        "seed": -1,
        "width": width,
        "height": height,
    }
    data = _post_jimeng_json(
        settings=settings,
        action="CVSync2AsyncSubmitTask",
        payload=payload,
        timeout=120,
    )
    task_id = _extract_jimeng_task_id(data)
    if not task_id:
        raise ImageGenerationError("Jimeng image response did not contain task_id.")
    return task_id


def _poll_jimeng_image_task(task_id: str, settings: Settings) -> dict[str, Any]:
    """轮询jimeng图片任务，统一主流程中的格式、默认值和异常边界。"""
    # 按“输入归一化 → 业务校验 → 状态或持久化”推进，异常不得留下半完成结果。
    max_attempts = max(settings.image_poll_max_attempts, 1)
    interval = max(settings.image_poll_interval_seconds, 1)
    payload = {
        "req_key": settings.image_model,
        "task_id": task_id,
        "req_json": json.dumps({"return_url": True}, ensure_ascii=False),
    }

    for _attempt in range(max_attempts):
        data = _post_jimeng_json(
            settings=settings,
            action="CVSync2AsyncGetResult",
            payload=payload,
            timeout=30,
        )
        status_value = _jimeng_status(data)
        if status_value in {"done", "succeeded", "success", ""} and _extract_jimeng_image_url(data):
            return data
        if status_value in {"failed", "expired", "not_found"}:
            raise ImageGenerationError(f"Jimeng image task ended with status: {status_value}")
        time.sleep(interval)

    raise ImageGenerationError("Jimeng image task timed out.")


def _post_jimeng_json(
    *,
    settings: Settings,
    action: str,
    payload: dict[str, Any],
    timeout: int,
) -> dict[str, Any]:
    """发送jimengJSON，统一主流程中的格式、默认值和异常边界。"""
    # 按“输入归一化 → 业务校验 → 状态或持久化”推进，异常不得留下半完成结果。
    try:
        access_key, secret_key = parse_access_key_pair(settings.image_api_key)
    except VolcengineCredentialsError as exc:
        raise ImageGenerationNotConfiguredError(str(exc)) from exc

    base_url = settings.image_base_url or "https://visual.volcengineapi.com"
    query = {"Action": action, "Version": "2022-08-31"}
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    headers = signed_json_headers(
        access_key=access_key,
        secret_key=secret_key,
        method="POST",
        url=base_url,
        query=query,
        body=body,
    )
    try:
        with httpx.Client(timeout=timeout) as client:
            response = client.post(base_url, params=query, content=body, headers=headers)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as exc:
        raise ImageGenerationError(_provider_error_detail(exc.response)) from exc
    except httpx.HTTPError as exc:
        raise ImageGenerationError(_http_error_detail("Jimeng image request failed", exc)) from exc

    code = data.get("code")
    if code != 10000:
        raise ImageGenerationError(str(data)[:500])
    return data


def _extract_jimeng_task_id(data: dict[str, Any]) -> str:
    """提取jimeng任务id，统一主流程中的格式、默认值和异常边界。"""
    # 按“输入归一化 → 业务校验 → 状态或持久化”推进，异常不得留下半完成结果。
    for container in (data.get("data"), data.get("Result"), data.get("output"), data):
        if isinstance(container, dict) and isinstance(container.get("task_id"), str):
            return container["task_id"]
    return ""


def _jimeng_status(data: dict[str, Any]) -> str:
    """jimeng状态，统一主流程中的格式、默认值和异常边界。"""
    # 按“输入归一化 → 业务校验 → 状态或持久化”推进，异常不得留下半完成结果。
    container = data.get("data")
    if isinstance(container, dict) and isinstance(container.get("status"), str):
        return container["status"].lower()
    if isinstance(data.get("status"), str):
        return data["status"].lower()
    return ""


def _extract_jimeng_image_url(data: dict[str, Any]) -> str:
    """提取jimeng图片URL，统一主流程中的格式、默认值和异常边界。"""
    # 按“输入归一化 → 业务校验 → 状态或持久化”推进，异常不得留下半完成结果。
    containers = [data.get("data"), data.get("Result"), data.get("output"), data]
    for container in containers:
        if not isinstance(container, dict):
            continue
        for key in ("image_url", "url"):
            value = container.get(key)
            if isinstance(value, str) and value:
                return value
        for key in ("image_urls", "urls", "result_urls"):
            value = container.get(key)
            if isinstance(value, list) and value and isinstance(value[0], str):
                return value[0]
        binary_data = container.get("binary_data_base64")
        if isinstance(binary_data, list) and binary_data:
            raise ImageGenerationError("Jimeng returned base64 image data; set return_url=true.")
    return ""


def _parse_image_size(size: str) -> tuple[int, int]:
    """解析图片size，统一主流程中的格式、默认值和异常边界。"""
    # 按“输入归一化 → 业务校验 → 状态或持久化”推进，异常不得留下半完成结果。
    normalized = size.replace("*", "x").lower()
    parts = normalized.split("x", 1)
    if len(parts) != 2:
        return 1328, 1328
    try:
        width = int(parts[0])
        height = int(parts[1])
    except ValueError:
        return 1328, 1328
    return max(width, 1), max(height, 1)


def _main_image_prompt(creative_plan: CreativePlan) -> str:
    """主流程图片prompt，统一主流程中的格式、默认值和异常边界。"""
    # 按“输入归一化 → 业务校验 → 状态或持久化”推进，异常不得留下半完成结果。
    content = creative_plan.content or {}
    image_prompt = content.get("image_prompt")
    if isinstance(image_prompt, str) and image_prompt.strip():
        return image_prompt.strip()

    prompt_parts = [
        f"电商商品主图，方案标题：{creative_plan.title}",
        f"主文案：{content.get('headline', '')}",
        f"副文案：{content.get('sub_headline', '')}",
        f"画面布局：{content.get('layout', '')}",
        f"视觉重点：{content.get('visual_focus', '')}",
        "干净背景，商品主体清晰，商业摄影质感，适合电商首图。",
    ]
    return "\n".join(part for part in prompt_parts if part.strip())


def _sanitize_image_prompt(prompt: str) -> str:
    """清洗图片prompt，统一主流程中的格式、默认值和异常边界。"""
    # 按“输入归一化 → 业务校验 → 状态或持久化”推进，异常不得留下半完成结果。
    replacements = {
        "\u00a5": "yuan",
        "\uffe5": "yuan",
        "\u201c": '"',
        "\u201d": '"',
        "\u2018": "'",
        "\u2019": "'",
        "\u2028": "\n",
        "\u2029": "\n",
    }
    for old, new in replacements.items():
        prompt = prompt.replace(old, new)

    return "".join(
        char for char in prompt if char in {"\n", "\t"} or ord(char) >= 32
    ).strip()

def _generate_alibaba_image(
    prompt: str,
    creative_plan: CreativePlan,
    settings: Settings,
) -> tuple[str, str, str]:
    """通过阿里云百炼（兼容模式）生成主图，返回 (task_id, 本地公开路径, 供应商源 URL)。

    支持两种返回形态：
    - 同步返回 ``data[0].url`` / ``data[0].b64_json``；
    - 异步返回 ``output.task_id``，再轮询 ``/api/v1/tasks/{task_id}``。
    """
    base_url = (settings.image_base_url or "").rstrip("/")
    if not base_url:
        raise ImageGenerationNotConfiguredError("IMAGE_BASE_URL is required for alibaba-image.")

    payload = {
        "model": settings.image_model,
        "prompt": prompt,
        "n": 1,
        "size": _openai_image_size(settings.image_size),
    }
    endpoint = f"{base_url}/images/generations"
    try:
        data = dashscope.post_json(
            endpoint,
            api_key=settings.image_api_key or "",
            payload=payload,
            timeout=120,
        )
    except dashscope.AlibabaAPIError as exc:
        # 部分百炼网关要求图片也走异步任务：先同步试，报路由/异步类错误时改用异步提交。
        if not _requires_async_submission(str(exc)):
            raise ImageGenerationError(str(exc)) from exc
        try:
            data = dashscope.post_json(
                endpoint,
                api_key=settings.image_api_key or "",
                payload=payload,
                timeout=120,
                async_call=True,
            )
        except dashscope.AlibabaAPIError as async_exc:
            raise ImageGenerationError(str(async_exc)) from async_exc

    task_id = dashscope.extract_task_id(data)
    if task_id and not dashscope.extract_result_url(data) and not dashscope.extract_b64_result(data):
        try:
            data = dashscope.poll_task(
                base_url,
                api_key=settings.image_api_key or "",
                task_id=task_id,
                interval_seconds=settings.image_poll_interval_seconds,
                max_attempts=settings.image_poll_max_attempts,
            )
        except dashscope.AlibabaAPIError as exc:
            raise ImageGenerationError(str(exc)) from exc

    encoded = dashscope.extract_b64_result(data)
    if encoded:
        return task_id, _save_generated_image_bytes(encoded, creative_plan.id), ""

    image_url = dashscope.extract_result_url(data)
    if not image_url:
        raise ImageGenerationError(
            f"Alibaba image response did not contain a result: {str(data)[:500]}"
        )
    return task_id, _download_generated_image(image_url, creative_plan.id), image_url


def _is_siliconflow_provider(provider: str | None) -> bool:
    """判断是否走硅基流动通道。"""
    value = (provider or "").lower()
    return value.startswith("silicon")


def _generate_siliconflow_image(
    prompt: str,
    creative_plan: CreativePlan,
    settings: Settings,
) -> tuple[str, str, str]:
    """通过硅基流动文生图，返回 (task_id, 本地公开路径, 供应商源 URL)。"""
    base_url = (settings.image_base_url or "").rstrip("/")
    if not base_url:
        raise ImageGenerationNotConfiguredError("IMAGE_BASE_URL is required for siliconflow.")

    payload = {
        "model": settings.image_model,
        "prompt": prompt,
        "image_size": siliconflow.normalize_size(settings.image_size),
        "batch_size": 1,
    }
    try:
        data = siliconflow.post_json(
            f"{base_url}/images/generations",
            api_key=settings.image_api_key or "",
            payload=payload,
            timeout=180,
        )
    except siliconflow.SiliconflowAPIError as exc:
        raise ImageGenerationError(str(exc)) from exc

    encoded = siliconflow.extract_image_b64(data)
    if encoded:
        return "", _save_generated_image_bytes(encoded, creative_plan.id), ""

    image_url = siliconflow.extract_image_url(data)
    if not image_url:
        raise ImageGenerationError(
            f"SiliconFlow image response did not contain a result: {str(data)[:500]}"
        )
    return "", _download_generated_image(image_url, creative_plan.id), image_url


def _requires_async_submission(message: str) -> bool:
    """判断错误是否属于"该接口需要异步任务提交"，用于同步失败后的异步降级。"""
    lowered = (message or "").lower()
    return "url error" in lowered or "asynchronous" in lowered


def _openai_image_size(size: str) -> str:
    """把 ``1024*1024`` 归一化为兼容模式要求的分辨率写法 ``1024x1024``。"""
    width, height = _parse_image_size(size)
    return f"{width}x{height}"


def _save_generated_image_bytes(encoded: str, creative_plan_id: int) -> str:
    """把供应商返回的 base64 图片写入 uploads 并返回可访问的公开路径。"""
    value = encoded.split(",", 1)[1] if encoded.startswith("data:") and "," in encoded else encoded
    try:
        content = base64.b64decode(value)
    except (ValueError, TypeError) as exc:
        raise ImageGenerationError("Alibaba image base64 payload could not be decoded.") from exc

    GENERATED_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"main-image-plan-{creative_plan_id}-{uuid.uuid4().hex}.png"
    (GENERATED_IMAGES_DIR / filename).write_bytes(content)
    return f"/uploads/generated/{filename}"


def _download_generated_image(image_url: str, creative_plan_id: int) -> str:
    """下载生成图片，统一主流程中的格式、默认值和异常边界。"""
    # 按“输入归一化 → 业务校验 → 状态或持久化”推进，异常不得留下半完成结果。
    GENERATED_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"main-image-plan-{creative_plan_id}-{uuid.uuid4().hex}.png"
    output_path = GENERATED_IMAGES_DIR / filename

    # 将供应商临时 URL 下载到本地 uploads，避免外部链接过期后素材审核记录失效。
    try:
        with httpx.Client(timeout=120, follow_redirects=True) as client:
            response = client.get(image_url)
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise ImageGenerationError(_http_error_detail("Generated image download failed", exc)) from exc

    output_path.write_bytes(response.content)
    return f"/uploads/generated/{filename}"


def _provider_error_detail(response: httpx.Response) -> str:
    """供应商错误详情，统一主流程中的格式、默认值和异常边界。"""
    try:
        data = response.json()
    except ValueError:
        return response.text[:500]
    return str(data)[:500]


def _http_error_detail(message: str, exc: httpx.HTTPError) -> str:
    """HTTP错误详情，统一主流程中的格式、默认值和异常边界。"""
    return f"{message}: {type(exc).__name__}: {exc}"