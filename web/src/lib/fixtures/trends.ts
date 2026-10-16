// 趋势看板使用 camelCase 视图模型（与 trend-dashboard.tsx 对齐），
// 与 types.ts 中 snake_case 的接口模型刻意区分：这里的数据只服务于图表渲染。

export type TrendRecord = {
  periodStart: string;
  periodEnd: string;
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
  spend: number | null;
  revenue: number | null;
  roi: number | null;
};

export type TrendCompetitor = {
  id: number;
  name: string;
  platform: string;
  price: string | null;
  salesHint: string | null;
};

export type TrendSnapshot = {
  competitorId: number;
  checkedAt: string;
  price: number | null;
  salesHint: string | null;
};

export type TrendProduct = {
  id: number;
  name: string;
  platform: string;
  price: string | null;
  records: TrendRecord[];
  competitors: TrendCompetitor[];
  snapshots: TrendSnapshot[];
};

/** 演示数据固定生成最近 30 天的日粒度记录。 */
const TREND_DAYS = 30;

/** 格式化为 YYYY-MM-DD（本地时区），避免 toISOString 带来的时区偏移。 */
function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** 以今天为终点，倒推生成最近 N 天的日期键（从早到晚）。 */
function recentDateKeys(days: number): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const keys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    keys.push(toDateKey(date));
  }
  return keys;
}

/**
 * 伪随机波动系数：由种子与天数推导，不使用 Math.random，
 * 保证同一份演示数据在多次渲染之间保持一致。
 */
function wave(seed: number, index: number): number {
  return 1 + Math.sin((seed + index) * 1.37) * 0.22 + Math.cos(seed * 0.73 + index * 0.41) * 0.13;
}

type TrendSeed = {
  id: number;
  name: string;
  platform: string;
  price: string;
  /** 日均曝光基数 */
  baseImpressions: number;
  /** 日均点击基数 */
  baseClicks: number;
  /** 日均成交基数 */
  baseConversions: number;
  /** 单次点击成本（元），用于推导推广花费 */
  cpc: number;
  /** 每隔 N 天视为「未投放」，花费与 ROI 记为 null */
  noSpendEvery?: number;
  competitors: Array<{
    name: string;
    platform: string;
    price: string;
    salesHint: string | null;
  }>;
};

/** 依据种子配置生成 30 天日粒度趋势记录。 */
function buildRecords(seed: TrendSeed): TrendRecord[] {
  const keys = recentDateKeys(TREND_DAYS);

  return keys.map((key, index) => {
    const factor = wave(seed.id, index);
    const impressions = Math.round(seed.baseImpressions * factor);
    const clicks = Math.round(seed.baseClicks * (1 + (factor - 1) * 0.8));
    const conversions = Math.max(0, Math.round(seed.baseConversions * factor));

    // 部分日期不投放，用于验证图表对 null 的处理。
    const skipSpend = seed.noSpendEvery ? index % seed.noSpendEvery === seed.noSpendEvery - 1 : false;
    if (skipSpend) {
      return {
        periodStart: key,
        periodEnd: key,
        impressions,
        clicks,
        conversions,
        spend: null,
        revenue: null,
        roi: null,
      };
    }

    const unitPrice = Number(seed.price);
    const spend = Number((clicks * seed.cpc * (1 + (factor - 1) * 0.3)).toFixed(2));
    const revenue = Number((conversions * unitPrice * (1 + (factor - 1) * 0.5)).toFixed(2));
    const roi = spend > 0 ? Number((revenue / spend).toFixed(2)) : null;

    return {
      periodStart: key,
      periodEnd: key,
      impressions,
      clicks,
      conversions,
      spend,
      revenue,
      roi,
    };
  });
}

/** 生成竞品快照：每 3 天采样一次，价格围绕当前售价小幅波动。 */
function buildSnapshots(competitor: TrendCompetitor): TrendSnapshot[] {
  const keys = recentDateKeys(TREND_DAYS);
  const basePrice = competitor.price ? Number(competitor.price) : 0;

  return keys
    .filter((_, index) => index % 3 === 0)
    .map((key, index) => ({
      competitorId: competitor.id,
      checkedAt: `${key}T08:30:00+08:00`,
      price:
        basePrice > 0
          ? Number((basePrice + Math.sin(competitor.id + index) * 3.5).toFixed(2))
          : null,
      salesHint: competitor.salesHint,
    }));
}

const TREND_SEEDS: TrendSeed[] = [
  {
    id: 1,
    name: "有机山泉稻花香大米",
    platform: "douyin",
    price: "89.90",
    baseImpressions: 6500,
    baseClicks: 320,
    baseConversions: 22,
    cpc: 0.92,
    competitors: [
      {
        name: "北大荒稻花香 5kg",
        platform: "douyin",
        price: "84.00",
        salesHint: "月销 3.2 万件",
      },
      {
        name: "金龙鱼五常大米 5kg",
        platform: "tmall",
        price: "99.90",
        salesHint: "月销 1.8 万件",
      },
      {
        name: "十月稻田长粒香 5kg",
        platform: "jd",
        price: "92.00",
        salesHint: "月销 2.4 万件",
      },
    ],
  },
  {
    id: 2,
    name: "有机黑猪五花肉",
    platform: "douyin",
    price: "128.00",
    baseImpressions: 3400,
    baseClicks: 180,
    baseConversions: 9,
    cpc: 1.35,
    noSpendEvery: 7,
    competitors: [
      {
        name: "土猪壹号五花肉",
        platform: "douyin",
        price: "138.00",
        salesHint: "月销 8600 件",
      },
      {
        name: "鲜丰黑猪肉铺",
        platform: "taobao",
        price: "119.00",
        salesHint: "月销 1.1 万件",
      },
    ],
  },
  {
    id: 3,
    name: "东北野生蓝莓",
    platform: "taobao",
    price: "69.90",
    baseImpressions: 2600,
    baseClicks: 150,
    baseConversions: 7,
    cpc: 0.88,
    competitors: [
      {
        name: "长白山林下蓝莓",
        platform: "taobao",
        price: "65.00",
        salesHint: "月销 7400 件",
      },
      {
        name: "北极蓝野生蓝莓",
        platform: "jd",
        price: "79.00",
        salesHint: "月销 3800 件",
      },
    ],
  },
  {
    id: 5,
    name: "有机山茶油",
    platform: "tmall",
    price: "198.00",
    baseImpressions: 1900,
    baseClicks: 95,
    baseConversions: 4,
    cpc: 2.15,
    competitors: [
      {
        name: "金浩茶油 500ml",
        platform: "tmall",
        price: "188.00",
        salesHint: "月销 1.5 万件",
      },
      {
        name: "山润有机茶油",
        platform: "jd",
        price: "228.00",
        salesHint: "月销 4200 件",
      },
    ],
  },
  {
    id: 7,
    name: "高山有机绿茶",
    platform: "pinduoduo",
    price: "59.00",
    baseImpressions: 9200,
    baseClicks: 480,
    baseConversions: 32,
    cpc: 0.41,
    competitors: [
      {
        name: "云雾绿茶 250g",
        platform: "pinduoduo",
        price: "49.90",
        salesHint: "月销 5.6 万件",
      },
      {
        name: "明前龙井 100g",
        platform: "taobao",
        price: "88.00",
        salesHint: "月销 1.2 万件",
      },
    ],
  },
];

/** 演示环境趋势数据：每个商品 30 天日粒度记录 + 2-3 个竞品 + 竞品快照。 */
export const demoTrendProducts: TrendProduct[] = TREND_SEEDS.map((seed) => {
  const competitors: TrendCompetitor[] = seed.competitors.map((item, index) => ({
    id: seed.id * 10 + index + 1,
    name: item.name,
    platform: item.platform,
    price: item.price,
    salesHint: item.salesHint,
  }));

  return {
    id: seed.id,
    name: seed.name,
    platform: seed.platform,
    price: seed.price,
    records: buildRecords(seed),
    competitors,
    snapshots: competitors.flatMap((competitor) => buildSnapshots(competitor)),
  };
});

/** 按商品 ID 获取演示趋势数据，未命中返回 null。 */
export function demoTrendProduct(id: number): TrendProduct | null {
  return demoTrendProducts.find((product) => product.id === id) ?? null;
}
