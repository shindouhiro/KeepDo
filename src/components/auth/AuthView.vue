<script setup lang="ts">
import { computed, ref } from 'vue'
import { Target, ArrowRight, Check, LockKeyhole, Cloud, LoaderCircle } from '@lucide/vue'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
const mode = ref<'login' | 'register'>('login')
const username = ref('')
const password = ref('')
const confirmation = ref('')
const validation = ref('')
const registering = computed(() => mode.value === 'register')
function switchMode() {
  mode.value = registering.value ? 'login' : 'register'
  validation.value = ''
  auth.error = ''
  password.value = ''
  confirmation.value = ''
}
async function submit() {
  validation.value = ''
  if (registering.value && password.value !== confirmation.value) {
    validation.value = '两次输入的密码不一致'
    return
  }
  if (await auth.authenticate(mode.value, username.value, password.value)) {
    password.value = ''
    confirmation.value = ''
  }
}
</script>

<template>
  <main class="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f5f6fa] px-5 py-12 dark:bg-[#0B0F17]">
    <div aria-hidden="true" class="pointer-events-none absolute -left-40 top-0 h-[34rem] w-[34rem] rounded-full bg-indigo-200/40 blur-3xl dark:bg-indigo-900/20"></div>
    <div aria-hidden="true" class="pointer-events-none absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-emerald-100/70 blur-3xl dark:bg-emerald-900/10"></div>
    <div class="relative grid w-full max-w-4xl gap-12 lg:grid-cols-2 lg:items-center lg:gap-20">
      <section class="hidden lg:block">
        <div class="mb-9 flex items-center gap-3">
          <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"><Target class="h-6 w-6" /></span>
          <span class="font-display text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">KeepDo</span>
        </div>
        <p class="mb-4 text-xs font-bold tracking-[0.2em] text-indigo-600 dark:text-indigo-400">行于微末 · 成于浩瀚</p>
        <h1 class="font-display text-4xl leading-snug font-bold tracking-tight text-slate-900 dark:text-white">每天一小步，<br />让成长有迹可循。</h1>
        <p class="mt-5 max-w-sm text-sm leading-7 text-slate-500 dark:text-slate-400">把长期目标拆成今天的行动。无论在哪台设备，你的计划、习惯与每一次进步，都在这里。</p>
        <ul class="mt-8 space-y-4 text-sm text-slate-600 dark:text-slate-300">
          <li class="flex items-center gap-3"><Check class="h-4 w-4 text-emerald-500" /> 目标、习惯与待办，一处管理</li>
          <li class="flex items-center gap-3"><Cloud class="h-4 w-4 text-indigo-500" /> 数据随账号保存，跨设备访问</li>
          <li class="flex items-center gap-3"><LockKeyhole class="h-4 w-4 text-indigo-500" /> 每个账号拥有独立的个人空间</li>
        </ul>
      </section>
      <section aria-labelledby="auth-heading" class="rounded-[2rem] border border-white/80 bg-white/85 p-7 shadow-xl shadow-slate-200/50 backdrop-blur-xl sm:p-10 dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-none">
        <div class="mb-7 flex items-center gap-2 text-indigo-600 lg:hidden dark:text-indigo-400"><Target class="h-6 w-6" /><span class="font-display text-xl font-bold">KeepDo</span></div>
        <p class="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{{ registering ? '从今天开始积累' : '继续你的成长旅程' }}</p>
        <h2 id="auth-heading" class="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{{ registering ? '创建你的账号' : '欢迎回来' }}</h2>
        <p class="mt-2 text-sm leading-6 text-slate-500">{{ registering ? '注册后，开始建立属于自己的行动空间。' : '登录后查看你的目标、习惯和今日行动。' }}</p>
        <form id="auth-form" class="mt-7 space-y-5" @submit.prevent="submit">
          <div>
            <label for="auth-username" class="mb-2 block text-xs font-semibold text-slate-700 dark:text-slate-300">用户名</label>
            <input id="auth-username" v-model="username" name="username" autocomplete="username" required minlength="3" maxlength="32" pattern="[a-zA-Z0-9_]+" autocapitalize="none" spellcheck="false" :disabled="auth.busy" placeholder="3–32 位字母、数字或下划线" class="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white" />
          </div>
          <div>
            <label for="auth-password" class="mb-2 block text-xs font-semibold text-slate-700 dark:text-slate-300">密码</label>
            <input id="auth-password" v-model="password" name="password" type="password" :autocomplete="registering ? 'new-password' : 'current-password'" required minlength="10" maxlength="128" :disabled="auth.busy" placeholder="至少 10 位，建议使用较长的独立密码" class="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white" />
          </div>
          <div v-if="registering">
            <label for="auth-password-confirm" class="mb-2 block text-xs font-semibold text-slate-700 dark:text-slate-300">确认密码</label>
            <input id="auth-password-confirm" v-model="confirmation" name="password-confirm" type="password" autocomplete="new-password" required minlength="10" maxlength="128" :disabled="auth.busy" placeholder="再次输入密码" class="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white" />
          </div>
          <p v-if="validation || auth.error" id="auth-error" role="alert" class="rounded-xl bg-rose-50 px-4 py-3 text-xs leading-6 text-rose-600 dark:bg-rose-950/30 dark:text-rose-300">{{ validation || auth.error }}</p>
          <button id="auth-submit" type="submit" :disabled="auth.busy" class="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/15 transition hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-500 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"><LoaderCircle v-if="auth.busy" class="h-4 w-4 animate-spin" />{{ auth.busy ? '正在处理…' : registering ? '注册并开始使用' : '登录我的空间' }}<ArrowRight v-if="!auth.busy" class="h-4 w-4" /></button>
        </form>
        <p class="mt-6 text-center text-xs text-slate-500">{{ registering ? '已经有账号？' : '还没有账号？' }}<button id="auth-switch-mode" type="button" :disabled="auth.busy" class="ml-1 rounded font-semibold text-indigo-600 hover:underline focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-50 dark:text-indigo-400" @click="switchMode">{{ registering ? '去登录' : '创建账号' }}</button></p>
        <p class="mt-7 border-t border-slate-100 pt-5 text-center text-[11px] leading-5 text-slate-400 dark:border-slate-800">{{ registering ? '请妥善保存密码，当前版本暂不提供找回密码。' : '每一点积累，都值得被好好保存。' }}</p>
      </section>
    </div>
  </main>
</template>
