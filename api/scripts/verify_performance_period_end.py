"""经营数据导入 period_end 修复的验证脚本（用项目自带 venv 跑真实服务层）。

背景（本次修复的 bug）：
    原代码 period_end = _parse_date(row.get("period_end", ""), ...) or period_start
    _parse_date 对空值会追加一条 "period_end 不能为空" 错误再返回 None，
    于是 "or period_start" 虽然把值兜回开始日期，errors 里却已留下错误 →
    预览接口把该行判为 error，导入时整行跳过。
    而后面跟的 or period_start 恰恰说明本意就是"period_end 可省"。
    运营录单日数据只填开始日期是最常见的写法，等于每次导入都莫名其妙少一行。

验证方式：内存 SQLite 建表 + 插一个商品，跑真实的 preview_performance_import。
"""
from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

API_ROOT = Path(__file__).resolve().parent.parent  # api/
sys.path.insert(0, str(API_ROOT))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.models import Platform, Product
from app.services.performance_import import preview_performance_import

PASSED: list[str] = []
FAILED: list[str] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    (PASSED if condition else FAILED).append(name)
    print(f"  {'✅' if condition else '❌'} {name}{'' if condition else '  ' + detail}")


def make_db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    session.add(Product(name="低糖燕麦饼干", platform=Platform.DOUYIN))
    session.commit()
    return session


def run_case(csv_text: str):
    db = make_db()
    try:
        return preview_performance_import(db, csv_text)
    finally:
        db.close()


def main() -> int:
    print("=" * 70)
    print("经营数据导入 period_end 验证")
    print("=" * 70)

    # ── 1) 单日数据：只填 period_start（bug 的触发场景）──────────────────
    print("\n[1] 单日经营数据：period_end 留空（bug 触发场景）")
    parsed, results = run_case(
        "product_name,period_start,impressions,clicks,conversions,spend,revenue\n"
        "低糖燕麦饼干,2026-05-01,12000,420,38,860.00,3420.00\n"
    )
    row = results[0]
    print(f"    status={row.status} errors={row.errors}")
    check("行被判为 valid（不再是 error）", row.status == "valid", f"status={row.status}")
    check("无错误信息", not row.errors, f"errors={row.errors}")
    check("解析出 1 行", len(parsed) == 1)
    if parsed:
        check("period_end 默认取 period_start", parsed[0].period_end == parsed[0].period_start,
              f"end={parsed[0].period_end}")
        check("period_start 解析正确", parsed[0].period_start == date(2026, 5, 1))
        check("指标列未受影响（impressions=12000）", parsed[0].impressions == 12000)

    # ── 2) 显式填写 period_end：原有行为不变 ────────────────────────────
    print("\n[2] 显式填写 period_end（原有行为回归）")
    parsed, results = run_case(
        "product_name,period_start,period_end,impressions\n"
        "低糖燕麦饼干,2026-05-01,2026-05-07,12000\n"
    )
    row = results[0]
    check("行仍为 valid", row.status == "valid", f"status={row.status} errors={row.errors}")
    check("period_end 取填写值", parsed[0].period_end == date(2026, 5, 7))

    # ── 3) period_end 早于 period_start：新增的数据完整性拦截 ───────────
    print("\n[3] period_end 早于 period_start（新增拦截）")
    parsed, results = run_case(
        "product_name,period_start,period_end\n"
        "低糖燕麦饼干,2026-05-07,2026-05-01\n"
    )
    row = results[0]
    print(f"    status={row.status} errors={row.errors}")
    check("行被判为 error", row.status == "error", f"status={row.status}")
    check("提示日期顺序错误",
          any("period_end 不能早于" in e for e in row.errors), f"errors={row.errors}")
    check("该行不进入待导入列表", len(parsed) == 0)

    # ── 4) period_start 缺失：仍然必须报错（原有校验不能被削弱）──────────
    print("\n[4] period_start 缺失（原有必填校验回归）")
    parsed, results = run_case(
        "product_name,period_end\n"
        "低糖燕麦饼干,2026-05-07\n"
    )
    row = results[0]
    print(f"    status={row.status} errors={row.errors}")
    check("行被判为 error", row.status == "error", f"status={row.status}")
    check("仍提示 period_start 不能为空",
          any("period_start 不能为空" in e for e in row.errors), f"errors={row.errors}")

    # ── 5) 非法日期值：仍然必须报错 ────────────────────────────────────
    print("\n[5] 非法日期值（原有格式校验回归）")
    parsed, results = run_case(
        "product_name,period_start,period_end\n"
        "低糖燕麦饼干,2026/05/01,not-a-date\n"
    )
    row = results[0]
    print(f"    status={row.status} errors={row.errors}")
    check("行被判为 error", row.status == "error", f"status={row.status}")
    check("仍提示日期格式错误",
          any("YYYY-MM-DD" in e for e in row.errors), f"errors={row.errors}")

    print("\n" + "=" * 70)
    print(f"通过 {len(PASSED)} 项，失败 {len(FAILED)} 项")
    if FAILED:
        for name in FAILED:
            print(f"  - {name}")
    print("=" * 70)
    return 1 if FAILED else 0


if __name__ == "__main__":
    raise SystemExit(main())
