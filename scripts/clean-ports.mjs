import { execSync } from 'node:child_process'

const ports = [8787, 5173]

function getParentPid(pid) {
  try {
    const ppidStr = execSync(`ps -o ppid= -p ${pid}`).toString().trim()
    const ppid = Number(ppidStr)
    return Number.isInteger(ppid) && ppid > 1 ? ppid : null
  } catch {
    return null
  }
}

function getCommand(pid) {
  try {
    return execSync(`ps -o command= -p ${pid}`).toString().trim()
  } catch {
    return ''
  }
}

const pidsToKill = new Set()

// 1. 查找端口占用的进程及其相关的父级 dev 进程
for (const port of ports) {
  try {
    const output = execSync(`lsof -ti :${port}`).toString().trim()
    if (output) {
      for (const line of output.split('\n')) {
        const pid = Number(line.trim())
        if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) {
          pidsToKill.add(pid)

          // 向上递归查找父进程，如果是 node / wrangler / vite 进程，一并加入待 kill 集合
          let cur = pid
          while (true) {
            const ppid = getParentPid(cur)
            if (!ppid || ppid <= 1) break
            const cmd = getCommand(ppid)
            if (/wrangler|vite|workerd|keepdo/i.test(cmd)) {
              pidsToKill.add(ppid)
              cur = ppid
            } else {
              break
            }
          }
        }
      }
    }
  } catch {}
}

// 2. 也检查孤儿状态的 workerd 进程
try {
  const psOutput = execSync('ps -eo pid,command').toString()
  for (const line of psOutput.split('\n')) {
    if (line.includes('workerd') && line.includes('KeepDo')) {
      const pid = Number(line.trim().split(/\s+/)[0])
      if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) {
        pidsToKill.add(pid)
      }
    }
  }
} catch {}

for (const pid of pidsToKill) {
  try {
    process.kill(pid, 'SIGKILL')
  } catch {}
}
