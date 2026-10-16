import type { ModelSettings, UserAccount } from "@/types";

const DEMO_CREATED_AT = "2026-09-18T09:00:00+08:00";
const DEMO_UPDATED_AT = "2026-10-12T18:40:00+08:00";

/**
 * 演示环境模型配置。
 * 注意：api_key_masked 一律为占位字符串，不含任何真实凭证。
 */
export const demoModelSettings: ModelSettings | null = {
  text: {
    base_url: "https://api.demo.local/v1",
    api_key_masked: "sk-demo-****************text",
    has_api_key: true,
    model: "demo-text-model",
  },
  image: {
    provider: "demo-image-provider",
    base_url: "https://api.demo.local/v1",
    api_key_masked: "sk-demo-****************image",
    has_api_key: true,
    model: "demo-image-model",
    size: "1024x1024",
    workspace_id: "demo-workspace",
    poll_interval_seconds: 5,
    poll_max_attempts: 60,
  },
  video: {
    provider: "demo-video-provider",
    base_url: "https://api.demo.local/v1",
    api_key_masked: "sk-demo-****************video",
    has_api_key: true,
    model: "demo-video-model",
    size: "1280x720",
    duration: 5,
    workspace_id: "demo-workspace",
    poll_interval_seconds: 10,
    poll_max_attempts: 90,
  },
};

/** 演示环境成员账号，覆盖 owner / operator / viewer 三种角色。 */
export const demoUsers: UserAccount[] = [
  {
    id: 1,
    email: "owner@demo.local",
    display_name: "王秀兰",
    role: "owner",
    status: "active",
    permissions: {
      can_read: true,
      can_edit: true,
      can_manage_users: true,
      can_confirm_ad_actions: true,
    },
    last_login_at: "2026-10-12T08:55:00+08:00",
    created_at: DEMO_CREATED_AT,
    updated_at: DEMO_UPDATED_AT,
  },
  {
    id: 2,
    email: "operator@demo.local",
    display_name: "李文强",
    role: "operator",
    status: "active",
    permissions: {
      can_read: true,
      can_edit: true,
      can_manage_users: false,
      can_confirm_ad_actions: false,
    },
    last_login_at: "2026-10-12T09:30:00+08:00",
    created_at: DEMO_CREATED_AT,
    updated_at: DEMO_UPDATED_AT,
  },
  {
    id: 3,
    email: "operator2@demo.local",
    display_name: "陈美玲",
    role: "operator",
    status: "active",
    permissions: {
      can_read: true,
      can_edit: true,
      can_manage_users: false,
      can_confirm_ad_actions: true,
    },
    last_login_at: "2026-10-11T20:12:00+08:00",
    created_at: DEMO_CREATED_AT,
    updated_at: DEMO_UPDATED_AT,
  },
  {
    id: 4,
    email: "viewer@demo.local",
    display_name: "赵建国",
    role: "viewer",
    status: "disabled",
    permissions: {
      can_read: true,
      can_edit: false,
      can_manage_users: false,
      can_confirm_ad_actions: false,
    },
    last_login_at: null,
    created_at: DEMO_CREATED_AT,
    updated_at: DEMO_UPDATED_AT,
  },
];
