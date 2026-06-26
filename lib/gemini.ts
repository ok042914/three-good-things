import { GoogleGenAI } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

const MODELS = {
  main: 'gemini-2.5-flash',
  lite: 'gemini-2.0-flash-lite',
  pro: 'gemini-2.5-pro',
}

const RETRY_DELAY_MS = 1000
const MAX_RETRIES = 2

// flash/lite が全滅したときに投げる特殊エラー
export class NeedsProConfirmationError extends Error {
  constructor() {
    super('NEEDS_PRO_CONFIRMATION')
    this.name = 'NeedsProConfirmationError'
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

type ContentItem = { role: 'user' | 'model'; parts: Array<{ text: string }> }
type GenerateConfig = Record<string, unknown>

type GenerateOptions = {
  contents: ContentItem[]
  config?: GenerateConfig
  // 'lite': 軽量タスク（要約など）, 'normal': 通常
  taskType?: 'lite' | 'normal'
  // true のときのみ pro フォールバックを実行する（デフォルト false）
  allowPro?: boolean
}

export async function generateWithFallback(options: GenerateOptions) {
  const { contents, config, taskType = 'normal', allowPro = false } = options

  // メインモデルで最大2回リトライ（初回含め計3回）
  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAY_MS)
    try {
      const response = await ai.models.generateContent({
        model: MODELS.main,
        contents,
        config,
      })
      return response
    } catch (error) {
      lastError = error
      console.error(`[gemini] main attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, error instanceof Error ? error.message : error)
    }
  }

  // liteフォールバック
  console.warn(`[gemini] falling back to ${MODELS.lite}`)
  try {
    const response = await ai.models.generateContent({
      model: MODELS.lite,
      contents,
      config,
    })
    return response
  } catch (error) {
    console.error(`[gemini] lite fallback failed:`, error instanceof Error ? error.message : error)
    lastError = error
  }

  // pro フォールバック（承認済みの場合のみ）
  if (!allowPro) {
    throw new NeedsProConfirmationError()
  }

  console.warn(`[gemini] falling back to ${MODELS.pro} (user approved)`)
  const response = await ai.models.generateContent({
    model: MODELS.pro,
    contents,
    config,
  })
  return response
}

// 会話履歴を直近N往復にトリミング（1往復 = user + model の2メッセージ）
export function trimHistory(
  history: Array<{ role: string; parts: string }>,
  maxTurns = 5
): Array<{ role: string; parts: string }> {
  const maxMessages = maxTurns * 2
  if (history.length <= maxMessages) return history
  return history.slice(-maxMessages)
}
