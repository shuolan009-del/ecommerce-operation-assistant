"""验证百炼（alibaba-image / alibaba-video）适配器：请求构造、异步轮询、落盘与错误透传。

全部使用 httpx.MockTransport，不访问真实供应商。
"""

from types import SimpleNamespace

import httpx
import pytest

from app.models import CreativePlan, CreativePlanType
from app.services import dashscope, image_generation, video_generation

PNG_BYTES = b"\x89PNG\r\n\x1a\nFAKE"
MP4_BYTES = b"\x00\x00\x00\x18ftypmp42FAKE"


def _patch_httpx(monkeypatch, handler):
    real_client = httpx.Client

    def factory(*args, **kwargs):
        kwargs["transport"] = httpx.MockTransport(handler)
        return real_client(*args, **kwargs)

    monkeypatch.setattr(httpx, "Client", factory)


def _image_settings(**overrides):
    values = dict(
        image_provider="alibaba-image",
        image_base_url="https://dash.example.com/compatible-mode/v1",
        image_api_key="sk-test",
        image_model="qwen-image-3.0-pro",
        image_size="1024*1024",
        image_poll_interval_seconds=1,
        image_poll_max_attempts=3,
    )
    values.update(overrides)
    return SimpleNamespace(**values)


def _video_settings(**overrides):
    values = dict(
        video_provider="alibaba-video",
        video_base_url="https://dash.example.com/compatible-mode/v1",
        video_api_key="sk-test",
        video_model="happyhorse-1.1-t2v",
        video_size="1280*720",
        video_duration=5,
        video_poll_interval_seconds=1,
        video_poll_max_attempts=3,
    )
    values.update(overrides)
    return SimpleNamespace(**values)


def _plan(plan_type, plan_id, content=None):
    return CreativePlan(
        id=plan_id,
        type=plan_type,
        title="测试方案",
        content=content or {"image_prompt": "a red apple", "video_prompt": "a cat walking"},
    )


def test_alibaba_image_sync_returns_url_and_saves_file(tmp_path, monkeypatch):
    """同步返回 data[0].url 时，应下载并落盘到生成目录。"""
    monkeypatch.setattr(image_generation, "GENERATED_IMAGES_DIR", tmp_path / "generated")
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST":
            seen["url"] = str(request.url)
            seen["headers"] = dict(request.headers)
            seen["body"] = request.content.decode("utf-8")
            return httpx.Response(200, json={"data": [{"url": "https://cdn.example.com/a.png"}]})
        return httpx.Response(200, content=PNG_BYTES)

    _patch_httpx(monkeypatch, handler)

    asset = image_generation.generate_main_image_asset(
        _plan(CreativePlanType.MAIN_IMAGE, 101), settings=_image_settings()
    )

    assert seen["url"].endswith("/compatible-mode/v1/images/generations")
    assert seen["headers"]["authorization"] == "Bearer sk-test"
    assert '"model":"qwen-image-3.0-pro"' in seen["body"].replace(" ", "")
    assert asset["url"].startswith("/uploads/generated/")
    saved = tmp_path / "generated" / asset["url"].rsplit("/", 1)[-1]
    assert saved.exists() and saved.read_bytes() == PNG_BYTES


def test_alibaba_image_async_polls_task_then_saves(tmp_path, monkeypatch):
    """异步返回 task_id 时，应轮询任务并在成功后落盘。"""
    monkeypatch.setattr(image_generation, "GENERATED_IMAGES_DIR", tmp_path / "generated")
    calls = {"polls": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST":
            assert request.headers.get("x-dashscope-async") is None  # 图片走同步提交
            return httpx.Response(200, json={"output": {"task_id": "task-1", "task_status": "PENDING"}})
        if "cdn.example.com" in str(request.url):
            return httpx.Response(200, content=PNG_BYTES)
        calls["polls"] += 1
        if calls["polls"] < 2:
            return httpx.Response(200, json={"output": {"task_id": "task-1", "task_status": "RUNNING"}})
        return httpx.Response(
            200,
            json={"output": {"task_id": "task-1", "task_status": "SUCCEEDED", "results": [{"url": "https://cdn.example.com/b.png"}]}},
        )

    _patch_httpx(monkeypatch, handler)

    asset = image_generation.generate_main_image_asset(
        _plan(CreativePlanType.MAIN_IMAGE, 102), settings=_image_settings()
    )

    assert asset["task_id"] == "task-1"
    assert calls["polls"] == 2
    assert (tmp_path / "generated" / asset["url"].rsplit("/", 1)[-1]).exists()


def test_alibaba_image_base64_saved(tmp_path, monkeypatch):
    """供应商直接返回 base64 时应解码落盘。"""
    monkeypatch.setattr(image_generation, "GENERATED_IMAGES_DIR", tmp_path / "generated")
    import base64

    encoded = base64.b64encode(PNG_BYTES).decode()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"data": [{"b64_json": encoded}]})

    _patch_httpx(monkeypatch, handler)

    asset = image_generation.generate_main_image_asset(
        _plan(CreativePlanType.MAIN_IMAGE, 103), settings=_image_settings()
    )
    saved = tmp_path / "generated" / asset["url"].rsplit("/", 1)[-1]
    assert saved.read_bytes() == PNG_BYTES


def test_alibaba_image_error_is_surfaced(tmp_path, monkeypatch):
    """供应商错误应原样透传，而不是被吞成 'Unsupported provider'。"""
    monkeypatch.setattr(image_generation, "GENERATED_IMAGES_DIR", tmp_path / "generated")

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            403,
            json={"error": {"message": "current user api does not support asynchronous calls", "code": "access_denied"}},
        )

    _patch_httpx(monkeypatch, handler)

    with pytest.raises(image_generation.ImageGenerationError) as excinfo:
        image_generation.generate_main_image_asset(
            _plan(CreativePlanType.MAIN_IMAGE, 104), settings=_image_settings()
        )
    assert "does not support asynchronous calls" in str(excinfo.value)


def test_alibaba_video_async_saves_mp4(tmp_path, monkeypatch):
    """视频走异步：提交带 X-DashScope-Async，轮询成功后下载 mp4。"""
    monkeypatch.setattr(video_generation, "GENERATED_VIDEOS_DIR", tmp_path / "generated-videos")
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST":
            seen["async"] = request.headers.get("x-dashscope-async")
            seen["body"] = request.content.decode("utf-8")
            return httpx.Response(200, json={"output": {"task_id": "v-1", "task_status": "PENDING"}})
        if "cdn.example.com" in str(request.url):
            return httpx.Response(200, content=MP4_BYTES)
        return httpx.Response(
            200,
            json={"output": {"task_id": "v-1", "task_status": "SUCCEEDED", "video_url": "https://cdn.example.com/v.mp4"}},
        )

    _patch_httpx(monkeypatch, handler)

    asset = video_generation.generate_video_asset(
        _plan(CreativePlanType.VIDEO_SCRIPT, 201), settings=_video_settings()
    )

    assert seen["async"] == "enable"
    assert '"model":"happyhorse-1.1-t2v"' in seen["body"].replace(" ", "")
    assert asset["url"].startswith("/uploads/generated-videos/")
    saved = tmp_path / "generated-videos" / asset["url"].rsplit("/", 1)[-1]
    assert saved.exists() and saved.read_bytes() == MP4_BYTES


def test_alibaba_video_error_is_surfaced(tmp_path, monkeypatch):
    monkeypatch.setattr(video_generation, "GENERATED_VIDEOS_DIR", tmp_path / "generated-videos")

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(403, json={"code": "AccessDenied", "message": "current user api does not support asynchronous calls"})

    _patch_httpx(monkeypatch, handler)

    with pytest.raises(video_generation.VideoGenerationError) as excinfo:
        video_generation.generate_video_asset(
            _plan(CreativePlanType.VIDEO_SCRIPT, 202), settings=_video_settings()
        )
    assert "does not support asynchronous calls" in str(excinfo.value)


def test_alibaba_image_falls_back_to_async_when_gateway_requires_it(tmp_path, monkeypatch):
    """同步提交报 url error 时，应自动改用异步提交并轮询落盘。"""
    monkeypatch.setattr(image_generation, "GENERATED_IMAGES_DIR", tmp_path / "generated")
    seen = {"async_attempted": False}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST":
            if request.headers.get("x-dashscope-async") != "enable":
                return httpx.Response(400, json={"code": "InvalidParameter", "message": "url error, please check url！"})
            seen["async_attempted"] = True
            return httpx.Response(200, json={"output": {"task_id": "t-async", "task_status": "PENDING"}})
        if "cdn.example.com" in str(request.url):
            return httpx.Response(200, content=PNG_BYTES)
        return httpx.Response(
            200,
            json={"output": {"task_status": "SUCCEEDED", "results": [{"url": "https://cdn.example.com/c.png"}]}},
        )

    _patch_httpx(monkeypatch, handler)

    asset = image_generation.generate_main_image_asset(
        _plan(CreativePlanType.MAIN_IMAGE, 105), settings=_image_settings()
    )
    assert seen["async_attempted"] is True
    assert asset["task_id"] == "t-async"
    assert (tmp_path / "generated" / asset["url"].rsplit("/", 1)[-1]).exists()


def test_tasks_url_derivation():
    assert (
        dashscope.tasks_url("https://host/compatible-mode/v1", "abc")
        == "https://host/api/v1/tasks/abc"
    )
    assert (
        dashscope.tasks_url("https://host/api/v1/", "abc")
        == "https://host/api/v1/tasks/abc"
    )
