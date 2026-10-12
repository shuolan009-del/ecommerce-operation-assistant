"""验证硅基流动（siliconflow）适配器：文生图、视频 submit/status 轮询、落盘与错误透传。

全部使用 httpx.MockTransport，不访问真实供应商。
"""

import base64
from types import SimpleNamespace

import httpx
import pytest

from app.models import CreativePlan, CreativePlanType
from app.services import image_generation, siliconflow, video_generation

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
        image_provider="siliconflow",
        image_base_url="https://api.siliconflow.cn/v1",
        image_api_key="sk-test",
        image_model="Tongyi-MAI/Z-Image-Turbo",
        image_size="1024x1024",
        image_poll_interval_seconds=1,
        image_poll_max_attempts=3,
    )
    values.update(overrides)
    return SimpleNamespace(**values)


def _video_settings(**overrides):
    values = dict(
        video_provider="siliconflow",
        video_base_url="https://api.siliconflow.cn/v1",
        video_api_key="sk-test",
        video_model="Wan-AI/Wan2.2-I2V-A14B",
        video_size="1280x720",
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


def test_siliconflow_image_saves_file(tmp_path, monkeypatch):
    """文生图返回 {"images":[{"url":...}]} 时应下载并落盘。"""
    monkeypatch.setattr(image_generation, "GENERATED_IMAGES_DIR", tmp_path / "generated")
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST":
            seen["url"] = str(request.url)
            seen["headers"] = dict(request.headers)
            seen["body"] = request.content.decode("utf-8")
            return httpx.Response(200, json={"images": [{"url": "https://cdn.example.com/a.png"}], "seed": 1})
        return httpx.Response(200, content=PNG_BYTES)

    _patch_httpx(monkeypatch, handler)

    asset = image_generation.generate_main_image_asset(
        _plan(CreativePlanType.MAIN_IMAGE, 301), settings=_image_settings()
    )

    assert seen["url"].endswith("/v1/images/generations")
    assert seen["headers"]["authorization"] == "Bearer sk-test"
    body = seen["body"].replace(" ", "")
    assert '"model":"Tongyi-MAI/Z-Image-Turbo"' in body
    assert '"image_size":"1024x1024"' in body
    assert asset["url"].startswith("/uploads/generated/")
    assert (tmp_path / "generated" / asset["url"].rsplit("/", 1)[-1]).read_bytes() == PNG_BYTES


def test_siliconflow_image_base64_saved(tmp_path, monkeypatch):
    monkeypatch.setattr(image_generation, "GENERATED_IMAGES_DIR", tmp_path / "generated")
    encoded = base64.b64encode(PNG_BYTES).decode()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"images": [{"b64_json": encoded}]})

    _patch_httpx(monkeypatch, handler)

    asset = image_generation.generate_main_image_asset(
        _plan(CreativePlanType.MAIN_IMAGE, 302), settings=_image_settings()
    )
    assert (tmp_path / "generated" / asset["url"].rsplit("/", 1)[-1]).read_bytes() == PNG_BYTES


def test_siliconflow_image_error_surfaced(tmp_path, monkeypatch):
    monkeypatch.setattr(image_generation, "GENERATED_IMAGES_DIR", tmp_path / "generated")

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"code": 20012, "message": "Model does not exist"})

    _patch_httpx(monkeypatch, handler)

    with pytest.raises(image_generation.ImageGenerationError) as excinfo:
        image_generation.generate_main_image_asset(
            _plan(CreativePlanType.MAIN_IMAGE, 303), settings=_image_settings()
        )
    assert "Model does not exist" in str(excinfo.value)


def test_siliconflow_video_submit_poll_saves_mp4(tmp_path, monkeypatch):
    monkeypatch.setattr(video_generation, "GENERATED_VIDEOS_DIR", tmp_path / "generated-videos")
    calls = {"submit": 0, "status": 0, "image_sent": False}
    png_url = "https://cdn.example.com/ref.png"

    def handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if url.endswith("/video/submit"):
            calls["submit"] += 1
            payload = request.content.decode("utf-8")
            calls["image_sent"] = png_url in payload
            return httpx.Response(200, json={"requestId": "req-1"})
        if url.endswith("/video/status"):
            calls["status"] += 1
            if calls["status"] < 2:
                return httpx.Response(200, json={"status": "InProgress", "results": None})
            return httpx.Response(
                200,
                json={"status": "Succeed", "results": {"videos": [{"url": "https://cdn.example.com/v.mp4"}]}},
            )
        return httpx.Response(200, content=MP4_BYTES)

    _patch_httpx(monkeypatch, handler)

    plan = _plan(
        CreativePlanType.VIDEO_SCRIPT,
        401,
        content={"video_prompt": "the apple rotates", "reference_images": [png_url]},
    )
    asset = video_generation.generate_video_asset(plan, settings=_video_settings())

    assert calls["submit"] == 1
    assert calls["status"] == 2
    assert calls["image_sent"] is True
    assert asset["task_id"] == "req-1"
    assert asset["url"].startswith("/uploads/generated-videos/")
    assert (tmp_path / "generated-videos" / asset["url"].rsplit("/", 1)[-1]).read_bytes() == MP4_BYTES


def test_siliconflow_i2v_requires_reference_image(tmp_path, monkeypatch):
    monkeypatch.setattr(video_generation, "GENERATED_VIDEOS_DIR", tmp_path / "generated-videos")

    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("不应发出请求：I2V 缺少参考图应在本地拦截")

    _patch_httpx(monkeypatch, handler)

    with pytest.raises(video_generation.VideoGenerationError) as excinfo:
        video_generation.generate_video_asset(
            _plan(CreativePlanType.VIDEO_SCRIPT, 402, content={"video_prompt": "x"}),
            settings=_video_settings(),
        )
    assert "参考图" in str(excinfo.value)


def test_normalize_size_and_url_extraction():
    assert siliconflow.normalize_size("1024*1024") == "1024x1024"
    assert siliconflow.normalize_size(None, "1280x720") == "1280x720"
    assert siliconflow.extract_image_url({"images": [{"url": "u"}]}) == "u"
    assert siliconflow.extract_image_url({"data": [{"url": "u2"}]}) == "u2"
    assert siliconflow.extract_video_url({"results": {"videos": [{"url": "v"}]}}) == "v"
    assert siliconflow.extract_video_url({"status": "InQueue", "results": None}) == ""
