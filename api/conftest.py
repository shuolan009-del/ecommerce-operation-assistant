import sys
from pathlib import Path

# 把 api/ 目录加入 sys.path，使 `from app...` 可导入
sys.path.insert(0, str(Path(__file__).resolve().parent))