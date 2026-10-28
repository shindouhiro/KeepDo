<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from './stores/auth'
import AuthView from './components/auth/AuthView.vue'
import KeepDoWorkspace from './components/KeepDoWorkspace.vue'

const auth = useAuthStore()
onMounted(() => { void auth.initialize() })
</script>

<template>
  <main v-if="auth.initializing || auth.initializationError" class="flex min-h-screen items-center justify-center bg-[#F8F9FA] p-6 dark:bg-[#0B0F17]">
    <div class="max-w-sm text-center" role="status">
      <h1 class="text-2xl font-bold text-indigo-600">KeepDo</h1>
      <p class="mt-4 text-sm leading-6 text-slate-500">{{ auth.initializing ? '正在连接你的个人空间…' : auth.initializationError }}</p>
      <button v-if="auth.initializationError" id="auth-initialize-retry" type="button" class="mt-5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500" @click="auth.initialize">重新连接</button>
    </div>
  </main>
  <KeepDoWorkspace v-else-if="auth.user" :key="auth.user.id" />
  <AuthView v-else />
</template>
