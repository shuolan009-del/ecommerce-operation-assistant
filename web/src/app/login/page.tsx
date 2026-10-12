import { LockKeyhole } from "lucide-react";
import Link from "next/link";

import { Button, Field, FormAlert, Input } from "@/components/ui";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/** 渲染登录页面；在服务端加载业务数据，并把交互交给对应表单或客户端组件。 */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const error = Array.isArray(params.error) ? params.error[0] : params.error;

  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-5 py-10 text-strong">
      <section className="w-full max-w-md rounded-lg border border-hairline bg-surface p-6 shadow-card">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand text-white">
            <LockKeyhole className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-brand">Ecommerce Operation Assistant</p>
            <h1 className="text-xl font-semibold text-strong">登录工作台</h1>
          </div>
        </div>

        {error ? (
          <FormAlert tone="error" className="mt-5">
            邮箱或密码不正确，或者账号已停用。
          </FormAlert>
        ) : null}

        <form action="/login/submit" method="post" className="mt-6 space-y-4">
          <Field label="邮箱">
            <Input name="email" type="email" required placeholder="owner@example.com" />
          </Field>
          <Field label="密码">
            <Input name="password" type="password" required placeholder="输入密码" />
          </Field>
          <Button type="submit" className="w-full">
            登录
          </Button>
        </form>

        <Link
          href="/"
          className="mt-4 inline-flex text-sm font-medium text-body transition-colors hover:text-strong"
        >
          返回首页
        </Link>
      </section>
    </main>
  );
}
