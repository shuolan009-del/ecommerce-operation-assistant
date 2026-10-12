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


class VideoGenerationNotConfiguredError(RuntimeError):
    pass


class VideoGenerationError(RuntimeError):
    pass


GENERATED_VIDEOS_DIR = API_DIR / "uploads" / "generated-videos"


def is_video_generation_configured(settings: Settings | None = None) -> bool:
    """判断视频生成任务configured；集中执行业务校验、状态变更与持久化，并返回可验证结果。"""
    settings = settings or get_runtime_settings()
    return bool(
        settings.video_provider
        and settings.video_base_url
        and settings.video_api_key
        and settings.video_model
    )


def generate_video_asset(
    creative_plan: CreativePlan,
    *,
    settings: Settings | None = None,
) -> dict[str, Any]:
    """生成视频素材；集中执行业务校验、状态变更与持久化，并返回可验证结果。"""
    # 按“输入归一化 → 业务校验 → 状态或持久化”推进，异常不得留下半完成结果。
    settings = settings or get_runtime_settings()
    if not is_video_generation_configured(settings):
        raise VideoGenerationNotConfiguredError("Video generation provider is not configured.")
    if settings.video_provider != "jimeng" and not _is_alibaba_provider(settings.video_provider) and not _is_siliconflow_provider(settings.video_provider):
        raise VideoGenerationNotConfiguredError(
            f"Unsupported video provider: {settings.video_provider}. "
            "This provider can be saved in settings, but its generation adapter is not implemented yet."
        )
    if creative_plan.type != CreativePlanType.VIDEO_SCRIPT:
        raise VideoGenerationError("Only video script plans can generate video assets.")

    # 视频生成保留 workflow 元数据，方便运营复核参考图、字幕和配音，不把结果做成只读黑盒。
    prompt = _sanitize_video_prompt(_video_prompt(creative_plan))
    workflow = _video_workflow(creative_plan)

    if _is_siliconflow_provider(settings.video_provider):
        # 硅基流动：/video/submit 提交 -> /video/status 轮询 -> 下载落盘。
        task_id, public_path, video_url = _generate_siliconflow_video(prompt, creative_plan, settings, workflow)
    elif _is_alibaba_provider(settings.video_provider):
        # 百炼（happyhorse 等）为异步任务制：提交 -> 轮询 task -> 下载落盘。
        task_id, public_path, video_url = _generate_alibaba_video(prompt, creative_plan, settings, workflow)
    else:
        if settings.video_model != "jimeng_t2v_v30":
            raise VideoGenerationNotConfiguredError("本章视频模型必须为 jimeng_t2v_v30。")
        task_id = create_jimeng_video_task(prompt, settings, workflow=workflow)
        result = poll_jimeng_video_task(task_id, settings)
        video_url = _extract_jimeng_video_url(result)
        public_path = _download_generated_video(video_url, creative_plan.id)

    return {
        "provider": settings.video_provider,
        "model": settings.video_model,
        "size": settings.video_size,
        "duration": settings.video_duration,
        "prompt": prompt,
        "workflow": workflow,
        "task_id": task_id,
        "source_url": video_url,
        "url": public_path,
        "created_at": int(time.time()),
    }


def _is_siliconflow_provider(provider: str | None) -> bool:
    """判断是否走硅基流动通道。"""
    return (provider or "").lower().startswith("silicon")


def _generate_siliconflow_video(
    prompt: str,
    creative_plan: CreativePlan,
    settings: Settings,
    workflow: dict[str, Any],
) -> tuple[str, str, str]:
    """通过硅基流动生成视频，返回 (requestId, 本地公开路径, 供应商源 URL)。"""
    base_url = (settings.video_base_url or "").rstrip("/")
    if not base_url:
        raise VideoGenerationNotConfiguredError("VIDEO_BASE_URL is required for siliconflow.")

    model = settings.video_model or ""
    reference_images = (workflow or {}).get("reference_images") or []
    payload: dict[str, Any] = {
        "model": model,
        "prompt": prompt,
        "image_size": siliconflow.normalize_size(settings.video_size, "1280x720"),
    }
    # I2V（图生视频）必须提供参考图；T2V 则不应传图。
    if reference_images:
        payload["image"] = reference_images[0]
    elif "i2v" in model.lower():
        raise VideoGenerationError(
            "硅基流动 I2V 模型需要参考图：请在该视频方案内容里补充 reference_images，"
            "或改用文生视频模型（如 Wan-AI/Wan2.2-T2V-A14B）。"
        )

    try:
        request_id = siliconflow.submit_video(
            base_url,
            api_key=settings.video_api_key or "",
            payload=payload,
        )
        data = siliconflow.poll_video(
            base_url,
            api_key=settings.video_api_key or "",
            request_id=request_id,
            interval_seconds=settings.video_poll_interval_seconds,
            max_attempts=settings.video_poll_max_attempts,
        )
    except siliconflow.SiliconflowAPIError as exc:
        raise VideoGenerationError(str(exc)) from exc

    video_url = siliconflow.extract_video_url(data)
    if not video_url:
        raise VideoGenerationError(
            f"SiliconFlow video response did not contain a result: {str(data)[:500]}"
        )
    return request_id, _download_generated_video(video_url, creative_plan.id), video_url


def _is_alibaba_provider(provider: str | None) -> bool:
    """判断是否走阿里云百炼（兼容模式）通道。"""
    value = (provider or "").lower()
    return value.startswith("alibaba") or value == "dashscope"


def _generate_alibaba_video(
    prompt: str,
    creative_plan: CreativePlan,
    settings: Settings,
    workflow: dict[str, Any],
) -> tuple[str, str, str]:
    """通过阿里云百炼生成视频，返回 (task_id, 本地公开路径, 供应商源 URL)。"""
    base_url = (settings.video_base_url or "").rstrip("/")
    if not base_url:
        raise VideoGenerationNotConfiguredError("VIDEO_BASE_URL is required for alibaba-video.")

    reference_images = (workflow or {}).get("reference_images") or []
    if reference_images:
        raise VideoGenerationError(
            "当前百炼文生视频模型不接受参考图，请清空 reference_images；图生视频需另接专用接口。"
        )

    payload = {
        "model": settings.video_model,
        "prompt": prompt,
        "size": _openai_video_size(settings.video_size),
        "duration": settings.video_duration,
        "n": 1,
    }
    try:
        # 百炼视频生成必须走异步：提交时携带 X-DashScope-Async: enable。
        data = dashscope.post_json(
            f"{base_url}/videos/generations",
            api_key=settings.video_api_key or "",
            payload=payload,
            timeout=120,
            async_call=True,
        )
        task_id = dashscope.extract_task_id(data)
        if task_id and not dashscope.extract_result_url(data):
            data = dashscope.poll_task(
                base_url,
                api_key=settings.video_api_key or "",
                task_id=task_id,
                interval_seconds=settings.video_poll_interval_seconds,
                max_attempts=settings.video_poll_max_attempts,
            )
    except dashscope.AlibabaAPIError as exc:
        raise VideoGenerationError(str(exc)) from exc

    if not task_id:
        raise VideoGenerationError("Alibaba video response did not contain task_id.")

    video_url = dashscope.extract_result_url(data)
    if not video_url:
        raise VideoGenerationError(
            f"Alibaba video response did not contain a result: {str(data)[:500]}"
        )
    return task_id, _download_generated_video(video_url, creative_plan.id), video_url


def _openai_video_size(size: str) -> str:
    """把 ``1280*720`` 归一化为兼容模式的分辨率写法 ``1280x720``。"""
    normalized = (size or "").replace("*", "x").lower().strip()
    return normalized or "1280x720"


def create_jimeng_video_task(
    prompt: str,
    settings: Settings,
    workflow: dict[str, Any] | None = None,
) -> str:
    """创建jimeng视频任务；集中执行业务校验、状态变更与持久化，并返回可验证结果。"""
    # 按“输入归一化 → 业务校验 → 状态或持久化”推进，异常不得留下半完成结果。
    payload = {
        "req_key": settings.video_model,
        "prompt": prompt,
        "seed": -1,
        "frames": _duration_to_frames(settings.video_duration),
        "aspect_ratio": _aspect_ratio_from_size(settings.video_size),
    }
    reference_images = (workflow or {}).get("reference_images") or []
    if reference_images:
        raise VideoGenerationError("jimeng_t2v_v30 是文生视频模型，请清空 reference_images；图生视频需另接专用接口。")
    data = _post_jimeng_video_json(
        settings=settings,
        action="CVSync2AsyncSubmitTask",
        payload=payload,
        timeout=120,
    )
    task_id = _extract_jimeng_task_id(data)
    if not task_id:
        raise VideoGenerationError("Jimeng video response did not contain task_id.")
    return task_id


def poll_jimeng_video_task(task_id: str, settings: Settings) -> dict[str, Any]:
    """轮询jimeng视频任务；集中执行业务校验、状态变更与持久化，并返回可验证结果。"""
    # 按“输入归一化 → 业务校验 → 状态或持久化”推进，异常不得留下半完成结果。
    max_attempts = max(settings.video_poll_max_attempts, 1)
    interval = max(settings.video_poll_interval_seconds, 1)
    payload = {"req_key": settings.video_model, "task_id": task_id}

    for _attempt in range(max_attempts):
        data = _post_jimeng_video_json(
            settings=settings,
            action="CVSync2AsyncGetResult",
            payload=payload,
            timeout=30,
        )
        status_value = _jimeng_status(data)
        if status_value in {"done", "succeeded", "success", ""} and _extract_jimeng_video_url(data):
            return data
        if status_value in {"failed", "expired", "not_found"}:
            raise VideoGenerationError(f"Jimeng video task ended with status: {status_value}")
        time.sleep(interval)

    raise VideoGenerationError("Jimeng video task timed out.")


def _post_jimeng_video_json(
    *,
    settings: Settings,
    action: str,
    payload: dict[str, Any],
    timeout: int,
) -> dict[str, Any]:
    """发送jimeng视频JSON，统一主流程中的格式、默认值和异常边界。"""
    # 按“输入归一化 → 业务校验 → 状态或持久化”推进，异常不得留下半完成结果。
    try:
        access_key, secret_key = parse_access_key_pair(settings.video_api_key)
    except VolcengineCredentialsError as exc:
        raise VideoGenerationNotConfiguredError(str(exc)) from exc

    base_url = settings.video_base_url or "https://visual.volcengineapi.com"
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
        raise VideoGenerationError(_provider_error_detail(exc.response)) from exc
    except httpx.HTTPError as exc:
        raise VideoGenerationError(_http_error_detail("Jimeng video request failed", exc)) from exc

    code = data.get("code")
    if code != 10000:
        raise VideoGenerationError(str(data)[:500])
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


def _extract_jimeng_video_url(data: dict[str, Any]) -> str:
    """提取jimeng视频URL，统一主流程中的格式、默认值和异常边界。"""
    # 按“输入归一化 → 业务校验 → 状态或持久化”推进，异常不得留下半完成结果。
    containers = [data.get("data"), data.get("Result"), data.get("output"), data]
    for container in containers:
        if not isinstance(container, dict):
            continue
        for key in ("video_url", "url"):
            value = container.get(key)
            if isinstance(value, str) and value:
                return value
        for key in ("video_urls", "urls", "result_urls"):
            value = container.get(key)
            if isinstance(value, list) and value and isinstance(value[0], str):
                return value[0]
    return ""


def _duration_to_frames(duration: int) -> int:
    """durationtoframes，统一主流程中的格式、默认值和异常边界。"""
    if duration not in {5, 10}:
        raise VideoGenerationError("即梦720P文生视频仅支持5秒或10秒。")
    return 24 * duration + 1


def _aspect_ratio_from_size(size: str) -> str:
    """aspect比率fromsize，统一主流程中的格式、默认值和异常边界。"""
    # 按“输入归一化 → 业务校验 → 状态或持久化”推进，异常不得留下半完成结果。
    normalized = size.replace("*", "x").lower()
    parts = normalized.split("x", 1)
    if len(parts) != 2:
        return "16:9"
    try:
        width = int(parts[0])
        height = int(parts[1])
    except ValueError:
        return "16:9"
    if width <= 0 or height <= 0:
        return "16:9"
    ratio = width / height
    candidates = {
        "16:9": 16 / 9,
        "4:3": 4 / 3,
        "1:1": 1,
        "3:4": 3 / 4,
        "9:16": 9 / 16,
        "21:9": 21 / 9,
    }
    return min(candidates, key=lambda item: abs(candidates[item] - ratio))


def _video_prompt(creative_plan: CreativePlan) -> str:
    """视频prompt，统一主流程中的格式、默认值和异常边界。"""
    # 按“输入归一化 → 业务校验 → 状态或持久化”推进，异常不得留下半完成结果。
    content = creative_plan.content or {}
    prompt = content.get("video_prompt")
    if isinstance(prompt, str) and prompt.strip():
        return prompt.strip()

    scene_lines: list[str] = []
    scenes = content.get("scenes", [])
    if isinstance(scenes, list):
        for scene in scenes:
            if not isinstance(scene, dict):
                continue
            visual = scene.get("visual", "")
            if isinstance(visual, str) and visual.strip():
                scene_lines.append(visual.strip())

    parts = [
        f"电商短视频，脚本标题：{creative_plan.title}",
        f"核心角度：{content.get('angle', '')}",
        f"开头钩子：{content.get('hook', '')}",
        "镜头画面：" + "；".join(scene_lines),
        f"转化引导：{content.get('cta', '')}",
        "商业广告质感，画面干净，产品主体清晰，适合电商信息流投放。",
    ]
    workflow_lines = _workflow_prompt_lines(content)
    if workflow_lines:
        parts.insert(-1, workflow_lines)
    return "\n".join(part for part in parts if part.strip())


def _video_workflow(creative_plan: CreativePlan) -> dict[str, Any]:
    """视频工作流，统一主流程中的格式、默认值和异常边界。"""
    content = creative_plan.content or {}
    reference_images = _string_list(content.get("reference_images"))
    return {
        "mode": "image_to_video" if reference_images else "text_to_video",
        "reference_images": reference_images,
        "subtitle_lines": _string_list(content.get("subtitle_lines")),
        "voiceover_text": _string_value(content.get("voiceover_text")),
        "edit_notes": _string_value(content.get("edit_notes")),
    }


def _workflow_prompt_lines(content: dict) -> str:
    """工作流promptlines，统一主流程中的格式、默认值和异常边界。"""
    # 按“输入归一化 → 业务校验 → 状态或持久化”推进，异常不得留下半完成结果。
    lines: list[str] = []
    if _string_list(content.get("reference_images")):
        lines.append("Reference image: keep the product shape, package texture, and hero color consistent.")
    subtitle_lines = _string_list(content.get("subtitle_lines"))
    if subtitle_lines:
        lines.append("Subtitle beats: " + " / ".join(subtitle_lines[:6]))
    voiceover_text = _string_value(content.get("voiceover_text"))
    if voiceover_text:
        lines.append("Voiceover: " + voiceover_text)
    edit_notes = _string_value(content.get("edit_notes"))
    if edit_notes:
        lines.append("Editing notes: " + edit_notes)
    return "\n".join(lines)


def _string_list(value: object) -> list[str]:
    """字符串查询，统一主流程中的格式、默认值和异常边界。"""
    # 按“输入归一化 → 业务校验 → 状态或持久化”推进，异常不得留下半完成结果。
    if isinstance(value, list):
        return [item.strip() for item in value if isinstance(item, str) and item.strip()]
    if isinstance(value, str):
        return [item.strip() for item in value.splitlines() if item.strip()]
    return []


def _string_value(value: object) -> str:
    """字符串值，统一主流程中的格式、默认值和异常边界。"""
    return value.strip() if isinstance(value, str) else ""


def _sanitize_video_prompt(prompt: str) -> str:
    """清洗视频prompt，统一主流程中的格式、默认值和异常边界。"""
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



def _download_generated_video(video_url: str, creative_plan_id: int) -> str:
    """下载生成视频，统一主流程中的格式、默认值和异常边界。"""
    # 按“输入归一化 → 业务校验 → 状态或持久化”推进，异常不得留下半完成结果。
    GENERATED_VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"video-plan-{creative_plan_id}-{uuid.uuid4().hex}.mp4"
    output_path = GENERATED_VIDEOS_DIR / filename

    # 下载成平台内素材地址，后续人工审核、编辑状态和投放实验都引用稳定路径。
    try:
        with httpx.Client(timeout=180, follow_redirects=True) as client:
            response = client.get(video_url)
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise VideoGenerationError(_http_error_detail("Generated video download failed", exc)) from exc

    output_path.write_bytes(response.content)
    return f"/uploads/generated-videos/{filename}"



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