import { useEffect, useState } from 'react'

interface FormMessage {
  type: 'error' | 'success'
  text: string
}

interface CardState {
  index: number
  referenceImagePath: string
  html?: string
  error?: string
  regenerating?: boolean
}

function App(): React.JSX.Element {
  const [keyword, setKeyword] = useState('')
  const [title, setTitle] = useState('')
  const [homepageUrl, setHomepageUrl] = useState('')
  const [thumbnailPath, setThumbnailPath] = useState('')
  const [message, setMessage] = useState<FormMessage | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [folderPath, setFolderPath] = useState('')

  const [hasApiKey, setHasApiKey] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [apiKeyMessage, setApiKeyMessage] = useState<FormMessage | null>(null)
  const [savingApiKey, setSavingApiKey] = useState(false)

  const [referenceImagePaths, setReferenceImagePaths] = useState<string[]>([])
  const [cards, setCards] = useState<CardState[]>([])
  const [generating, setGenerating] = useState(false)
  const [cardsMessage, setCardsMessage] = useState<FormMessage | null>(null)

  useEffect(() => {
    async function refreshApiKeyStatus(): Promise<void> {
      const result = await window.api.getApiKeyStatus()
      if (result.ok) {
        setHasApiKey(result.data.hasApiKey)
      }
    }

    void refreshApiKeyStatus()
  }, [])

  async function handleSelectThumbnail(): Promise<void> {
    const selectedPath = await window.api.selectThumbnail()
    if (selectedPath) {
      setThumbnailPath(selectedPath)
    }
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setSubmitting(true)
    setMessage(null)

    try {
      const result = await window.api.registerContent({
        keyword,
        title,
        homepageUrl,
        thumbnailPath
      })

      if (result.ok) {
        setMessage({ type: 'success', text: `등록 완료: ${result.data.folderPath}` })
        setFolderPath(result.data.folderPath)
      } else {
        setMessage({ type: 'error', text: result.error.message })
      }
    } catch {
      setMessage({ type: 'error', text: '등록 중 알 수 없는 오류가 발생했습니다' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSaveApiKey(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setSavingApiKey(true)
    setApiKeyMessage(null)

    try {
      const result = await window.api.saveApiKey({ apiKey: apiKeyInput })
      if (result.ok) {
        setApiKeyMessage({ type: 'success', text: 'API 키가 저장되었습니다' })
        setApiKeyInput('')
        setHasApiKey(true)
      } else {
        setApiKeyMessage({ type: 'error', text: result.error.message })
      }
    } catch {
      setApiKeyMessage({ type: 'error', text: 'API 키 저장 중 알 수 없는 오류가 발생했습니다' })
    } finally {
      setSavingApiKey(false)
    }
  }

  async function handleSelectReferenceImages(): Promise<void> {
    const result = await window.api.selectReferenceImages()
    if (result.paths.length > 0) {
      setReferenceImagePaths(result.paths)
    }
    setCardsMessage(
      result.truncated
        ? {
            type: 'error',
            text: '참고이미지는 최대 10장까지만 사용됩니다. 처음 10장만 선택되었습니다.'
          }
        : null
    )
  }

  async function handleGenerateCards(): Promise<void> {
    setGenerating(true)
    setCardsMessage(null)

    try {
      const result = await window.api.generateCards({
        contentFolderPath: folderPath,
        keyword,
        referenceImagePaths
      })

      if (result.ok) {
        setCards(
          result.data.cards.map((card) => ({
            index: card.index,
            referenceImagePath: referenceImagePaths[card.index - 1],
            html: card.status === 'success' ? card.html : undefined,
            error: card.status === 'failure' ? card.error : undefined
          }))
        )
      } else {
        setCardsMessage({ type: 'error', text: result.error.message })
      }
    } catch {
      setCardsMessage({ type: 'error', text: '카드 생성 중 알 수 없는 오류가 발생했습니다' })
    } finally {
      setGenerating(false)
    }
  }

  async function handleRegenerateCard(card: CardState): Promise<void> {
    setCards((previous) =>
      previous.map((item) => (item.index === card.index ? { ...item, regenerating: true } : item))
    )

    try {
      const result = await window.api.regenerateCard({
        contentFolderPath: folderPath,
        keyword,
        referenceImagePath: card.referenceImagePath,
        index: card.index
      })

      if (result.ok) {
        const updated = result.data.card
        setCards((previous) =>
          previous.map((item) =>
            item.index === card.index
              ? {
                  ...item,
                  html: updated.status === 'success' ? updated.html : undefined,
                  error: updated.status === 'failure' ? updated.error : undefined,
                  regenerating: false
                }
              : item
          )
        )
      } else {
        setCardsMessage({ type: 'error', text: result.error.message })
        setCards((previous) =>
          previous.map((item) =>
            item.index === card.index ? { ...item, regenerating: false } : item
          )
        )
      }
    } catch {
      setCardsMessage({ type: 'error', text: '카드 재생성 중 알 수 없는 오류가 발생했습니다' })
      setCards((previous) =>
        previous.map((item) =>
          item.index === card.index ? { ...item, regenerating: false } : item
        )
      )
    }
  }

  return (
    <div className="app-root">
      <form className="api-key-form" onSubmit={handleSaveApiKey}>
        <h2>Claude API 키</h2>
        <p>{hasApiKey ? '설정됨' : '미설정'}</p>
        <input
          type="password"
          placeholder="sk-ant-..."
          value={apiKeyInput}
          onChange={(event) => setApiKeyInput(event.target.value)}
        />
        <button type="submit" disabled={savingApiKey}>
          저장
        </button>
        {apiKeyMessage && (
          <div className={`message ${apiKeyMessage.type}`}>{apiKeyMessage.text}</div>
        )}
      </form>

      <form className="registration-form" onSubmit={handleSubmit}>
        <h1>썸네일 등록</h1>

        <label>
          키워드
          <input
            type="text"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            disabled={Boolean(folderPath)}
          />
        </label>

        <label>
          제목
          <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>

        <label>
          홈페이지 URL
          <input
            type="url"
            value={homepageUrl}
            onChange={(event) => setHomepageUrl(event.target.value)}
          />
        </label>

        <div className="thumbnail-row">
          <button type="button" onClick={handleSelectThumbnail}>
            썸네일 선택
          </button>
          <span>{thumbnailPath || '선택된 파일 없음'}</span>
        </div>

        {message && <div className={`message ${message.type}`}>{message.text}</div>}

        <button type="submit" disabled={submitting}>
          등록
        </button>
      </form>

      {folderPath && (
        <div className="card-generation-section">
          <h2>정보카드 생성</h2>

          <div className="reference-images-row">
            <button type="button" onClick={handleSelectReferenceImages}>
              참고이미지 선택 (최대 10장)
            </button>
            <span>
              {referenceImagePaths.length > 0
                ? `${referenceImagePaths.length}장 선택됨`
                : '선택된 파일 없음'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleGenerateCards}
            disabled={generating || referenceImagePaths.length === 0}
          >
            카드 생성
          </button>

          {cardsMessage && (
            <div className={`message ${cardsMessage.type}`}>{cardsMessage.text}</div>
          )}

          <div className="card-list">
            {cards.map((card) => (
              <div key={card.index} className="card-preview">
                {card.error ? (
                  <div className="message error">
                    카드 {card.index}: {card.error}
                  </div>
                ) : (
                  <div className="card-frame">
                    <iframe
                      sandbox="allow-same-origin"
                      srcDoc={card.html}
                      width={1080}
                      height={1350}
                      title={`card-${card.index}`}
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleRegenerateCard(card)}
                  disabled={card.regenerating}
                >
                  재생성
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
