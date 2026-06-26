import { useEffect, useRef, useState } from 'react'
import {
  CARD_CSS_VARIABLES,
  type CardCssVariable,
  enableInlineEditing,
  findElementRange,
  getCssVariableValues,
  serializeCardDocument,
  setCssVariable
} from './cardEditing'

interface FormMessage {
  type: 'error' | 'success'
  text: string
}

interface CardState {
  index: number
  referenceImagePath: string
  html?: string
  htmlPath?: string
  error?: string
  regenerating?: boolean
  saveError?: string
}

const CSS_VARIABLE_LABELS: Record<CardCssVariable, string> = {
  '--card-bg-color': '배경색',
  '--card-primary-color': '주요색',
  '--card-text-color': '텍스트색',
  '--card-accent-color': '강조색'
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
  const [cardCssValues, setCardCssValues] = useState<
    Record<number, Record<CardCssVariable, string>>
  >({})
  const [codePanelOpen, setCodePanelOpen] = useState<Record<number, boolean>>({})
  const [codeText, setCodeText] = useState<Record<number, string>>({})
  const [instructionText, setInstructionText] = useState<Record<number, string>>({})
  const [previousHtml, setPreviousHtml] = useState<Record<number, string>>({})
  const [applyingInstruction, setApplyingInstruction] = useState<Record<number, boolean>>({})
  const [renderingImages, setRenderingImages] = useState(false)
  const [imageRenderResults, setImageRenderResults] = useState<Record<number, FormMessage>>({})

  const iframeRefs = useRef(new Map<number, HTMLIFrameElement>())
  const saveTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>())
  const cardsRef = useRef<CardState[]>([])
  const codePanelOpenRef = useRef<Record<number, boolean>>({})
  const codeTextRef = useRef<Record<number, string>>({})
  const codeTextareaRefs = useRef(new Map<number, HTMLTextAreaElement>())
  const applyingInstructionRef = useRef(new Set<number>())

  useEffect(() => {
    cardsRef.current = cards
  }, [cards])

  useEffect(() => {
    codePanelOpenRef.current = codePanelOpen
  }, [codePanelOpen])

  useEffect(() => {
    codeTextRef.current = codeText
  }, [codeText])

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
            htmlPath: card.status === 'success' ? card.htmlPath : undefined,
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
    // Cancel any pending debounced save for this card — otherwise a stale edit from
    // before regeneration could fire afterwards and overwrite the freshly regenerated file.
    const pendingTimer = saveTimers.current.get(card.index)
    if (pendingTimer) {
      clearTimeout(pendingTimer)
      saveTimers.current.delete(card.index)
    }

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
        // Close the code panel and drop any AI-edit undo snapshot only once regeneration
        // actually succeeded — a failed attempt leaves card.html untouched, so both are
        // still valid and shouldn't be thrown away.
        setCodePanelOpen((previous) => ({ ...previous, [card.index]: false }))
        setPreviousHtml((previous) => {
          const next = { ...previous }
          delete next[card.index]
          return next
        })
        setCards((previous) =>
          previous.map((item) =>
            item.index === card.index
              ? {
                  ...item,
                  html: updated.status === 'success' ? updated.html : undefined,
                  htmlPath: updated.status === 'success' ? updated.htmlPath : undefined,
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

  function scheduleSave(cardIndex: number, doc: Document): void {
    const existingTimer = saveTimers.current.get(cardIndex)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    const timer = setTimeout(async () => {
      const htmlPath = cardsRef.current.find((item) => item.index === cardIndex)?.htmlPath
      if (!htmlPath) return

      const html = serializeCardDocument(doc)
      try {
        const result = await window.api.saveCardHtml({ htmlPath, html })
        setCards((previous) =>
          previous.map((item) =>
            item.index === cardIndex
              ? { ...item, saveError: result.ok ? undefined : result.error.message }
              : item
          )
        )
      } catch {
        setCards((previous) =>
          previous.map((item) =>
            item.index === cardIndex
              ? { ...item, saveError: '카드 저장 중 알 수 없는 오류가 발생했습니다' }
              : item
          )
        )
      }
    }, 500)
    saveTimers.current.set(cardIndex, timer)
  }

  function handleCardIframeLoad(
    cardIndex: number,
    event: React.SyntheticEvent<HTMLIFrameElement>
  ): void {
    const iframe = event.currentTarget
    const doc = iframe.contentDocument
    if (!doc) return

    iframeRefs.current.set(cardIndex, iframe)
    enableInlineEditing(doc)
    setCardCssValues((previous) => ({ ...previous, [cardIndex]: getCssVariableValues(doc) }))
    doc.body.addEventListener('input', () => scheduleSave(cardIndex, doc))
    doc.body.addEventListener('click', (event) => {
      const region = (event.target as Element).closest('[data-edit-id]')
      const editId = region?.getAttribute('data-edit-id')
      if (editId) handleElementClick(cardIndex, editId)
    })
  }

  function handleColorChange(
    cardIndex: number,
    variableName: CardCssVariable,
    value: string
  ): void {
    const iframe = iframeRefs.current.get(cardIndex)
    const doc = iframe?.contentDocument
    if (!doc) return

    setCssVariable(doc, variableName, value)
    setCardCssValues((previous) => ({
      ...previous,
      [cardIndex]: { ...previous[cardIndex], [variableName]: value }
    }))
    scheduleSave(cardIndex, doc)
  }

  function handleToggleCodePanel(cardIndex: number): void {
    const opening = !codePanelOpenRef.current[cardIndex]
    if (opening) {
      const doc = iframeRefs.current.get(cardIndex)?.contentDocument
      // Prefer the live iframe DOM (reflects inline edits not yet in `card.html`), but the
      // iframe may not have finished loading yet right after generation — fall back to
      // `card.html` rather than leaving the panel blank.
      const html = doc
        ? serializeCardDocument(doc)
        : cardsRef.current.find((item) => item.index === cardIndex)?.html
      if (html !== undefined) {
        setCodeText((previous) => ({ ...previous, [cardIndex]: html }))
      }
    }
    setCodePanelOpen((previous) => ({ ...previous, [cardIndex]: opening }))
  }

  function scheduleCodeCommit(cardIndex: number, html: string): void {
    const existingTimer = saveTimers.current.get(cardIndex)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    const timer = setTimeout(async () => {
      setCards((previous) =>
        previous.map((item) => (item.index === cardIndex ? { ...item, html } : item))
      )

      const htmlPath = cardsRef.current.find((item) => item.index === cardIndex)?.htmlPath
      if (!htmlPath) return

      try {
        const result = await window.api.saveCardHtml({ htmlPath, html })
        setCards((previous) =>
          previous.map((item) =>
            item.index === cardIndex
              ? { ...item, saveError: result.ok ? undefined : result.error.message }
              : item
          )
        )
      } catch {
        setCards((previous) =>
          previous.map((item) =>
            item.index === cardIndex
              ? { ...item, saveError: '카드 저장 중 알 수 없는 오류가 발생했습니다' }
              : item
          )
        )
      }
    }, 500)
    saveTimers.current.set(cardIndex, timer)
  }

  function handleCodeTextChange(cardIndex: number, value: string): void {
    setCodeText((previous) => ({ ...previous, [cardIndex]: value }))
    scheduleCodeCommit(cardIndex, value)
  }

  function handleElementClick(cardIndex: number, editId: string): void {
    if (!codePanelOpenRef.current[cardIndex]) return

    const text = codeTextRef.current[cardIndex]
    const textarea = codeTextareaRefs.current.get(cardIndex)
    if (!text || !textarea) return

    const range = findElementRange(text, editId)
    if (!range) return

    textarea.focus()
    textarea.setSelectionRange(range.start, range.end)

    const totalLines = text.split('\n').length || 1
    const linesBeforeStart = text.slice(0, range.start).split('\n').length - 1
    const lineHeight = textarea.scrollHeight / totalLines
    textarea.scrollTop = linesBeforeStart * lineHeight
  }

  async function handleApplyInstruction(card: CardState): Promise<void> {
    const instruction = instructionText[card.index]?.trim()
    if (!instruction || !card.htmlPath) return
    // Synchronous re-entrancy guard — the button's `disabled` prop only takes effect after
    // React re-renders, so a rapid double-click could otherwise fire two concurrent requests.
    if (applyingInstructionRef.current.has(card.index)) return
    applyingInstructionRef.current.add(card.index)

    const doc = iframeRefs.current.get(card.index)?.contentDocument
    const currentHtml = doc ? serializeCardDocument(doc) : card.html
    if (!currentHtml) {
      applyingInstructionRef.current.delete(card.index)
      return
    }

    // Cancel any pending inline/code-panel debounced save — otherwise it could fire after
    // this AI edit completes and overwrite the freshly edited file with the pre-edit content.
    const pendingTimer = saveTimers.current.get(card.index)
    if (pendingTimer) {
      clearTimeout(pendingTimer)
      saveTimers.current.delete(card.index)
    }

    setApplyingInstruction((previous) => ({ ...previous, [card.index]: true }))
    setCardsMessage(null)

    try {
      const result = await window.api.editCardWithInstruction({
        htmlPath: card.htmlPath,
        html: currentHtml,
        instruction
      })

      if (result.ok) {
        const newHtml = result.data.html
        setPreviousHtml((previous) => ({ ...previous, [card.index]: currentHtml }))
        setCards((previous) =>
          previous.map((item) => (item.index === card.index ? { ...item, html: newHtml } : item))
        )
        if (codePanelOpenRef.current[card.index]) {
          setCodeText((previous) => ({ ...previous, [card.index]: newHtml }))
        }
        setInstructionText((previous) => ({ ...previous, [card.index]: '' }))
      } else {
        setCardsMessage({ type: 'error', text: result.error.message })
      }
    } catch {
      setCardsMessage({ type: 'error', text: 'AI 편집 중 알 수 없는 오류가 발생했습니다' })
    } finally {
      setApplyingInstruction((previous) => ({ ...previous, [card.index]: false }))
      applyingInstructionRef.current.delete(card.index)
    }
  }

  async function handleRevertInstruction(card: CardState): Promise<void> {
    const restoredHtml = previousHtml[card.index]
    if (!restoredHtml || !card.htmlPath) return

    setCards((previous) =>
      previous.map((item) => (item.index === card.index ? { ...item, html: restoredHtml } : item))
    )
    if (codePanelOpenRef.current[card.index]) {
      setCodeText((previous) => ({ ...previous, [card.index]: restoredHtml }))
    }

    try {
      const result = await window.api.saveCardHtml({ htmlPath: card.htmlPath, html: restoredHtml })
      if (result.ok) {
        // Only drop the snapshot once the revert is actually persisted — if the save failed,
        // keep it so the user can retry instead of losing recoverability silently.
        setPreviousHtml((previous) => {
          const next = { ...previous }
          delete next[card.index]
          return next
        })
      }
      setCards((previous) =>
        previous.map((item) =>
          item.index === card.index
            ? { ...item, saveError: result.ok ? undefined : result.error.message }
            : item
        )
      )
    } catch {
      setCards((previous) =>
        previous.map((item) =>
          item.index === card.index
            ? { ...item, saveError: '카드 저장 중 알 수 없는 오류가 발생했습니다' }
            : item
        )
      )
    }
  }

  async function handleRenderImages(): Promise<void> {
    const renderableCards = cardsRef.current.filter((item) => item.htmlPath)
    if (renderableCards.length === 0) return

    // Cancel pending debounced inline/code-panel saves first — otherwise one could fire after
    // the live DOM is read below and redundantly re-save the same content mid-render.
    for (const item of renderableCards) {
      const pendingTimer = saveTimers.current.get(item.index)
      if (pendingTimer) {
        clearTimeout(pendingTimer)
        saveTimers.current.delete(item.index)
      }
    }

    setRenderingImages(true)
    setCardsMessage(null)
    setImageRenderResults({})

    try {
      const result = await window.api.renderCardsToImages({
        cards: renderableCards.map((item) => {
          const doc = iframeRefs.current.get(item.index)?.contentDocument
          const html = doc ? serializeCardDocument(doc) : (item.html as string)
          return { index: item.index, htmlPath: item.htmlPath as string, html }
        })
      })

      if (result.ok) {
        const nextResults: Record<number, FormMessage> = {}
        for (const cardResult of result.data.results) {
          nextResults[cardResult.index] =
            cardResult.status === 'success'
              ? {
                  type: 'success',
                  text: `카드 ${cardResult.index}: ${cardResult.imagePath} 저장 완료`
                }
              : {
                  type: 'error',
                  text: `카드 ${cardResult.index}: 렌더링 실패 - ${cardResult.error}`
                }
        }
        setImageRenderResults(nextResults)
      } else {
        setCardsMessage({ type: 'error', text: result.error.message })
      }
    } catch {
      setCardsMessage({ type: 'error', text: '이미지 렌더링 중 알 수 없는 오류가 발생했습니다' })
    } finally {
      setRenderingImages(false)
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

          {cards.some((card) => card.htmlPath) && (
            <button type="button" onClick={handleRenderImages} disabled={renderingImages}>
              {renderingImages ? '이미지 렌더링 중...' : '이미지로 렌더링'}
            </button>
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
                      onLoad={(event) => handleCardIframeLoad(card.index, event)}
                    />
                  </div>
                )}

                {!card.error && (
                  <div className="card-color-controls">
                    {CARD_CSS_VARIABLES.map((variableName) => (
                      <label key={variableName} className="card-color-control">
                        {CSS_VARIABLE_LABELS[variableName]}
                        <input
                          type="color"
                          value={cardCssValues[card.index]?.[variableName] || '#000000'}
                          onChange={(event) =>
                            handleColorChange(card.index, variableName, event.target.value)
                          }
                        />
                      </label>
                    ))}
                  </div>
                )}

                {card.saveError && <div className="message error">{card.saveError}</div>}

                {imageRenderResults[card.index] && (
                  <div className={`message ${imageRenderResults[card.index].type}`}>
                    {imageRenderResults[card.index].text}
                  </div>
                )}

                {!card.error && (
                  <button type="button" onClick={() => handleToggleCodePanel(card.index)}>
                    {codePanelOpen[card.index] ? '코드 닫기' : '코드 보기'}
                  </button>
                )}

                {codePanelOpen[card.index] && (
                  <textarea
                    className="card-code-panel"
                    ref={(el) => {
                      if (el) codeTextareaRefs.current.set(card.index, el)
                      else codeTextareaRefs.current.delete(card.index)
                    }}
                    value={codeText[card.index] ?? ''}
                    onChange={(event) => handleCodeTextChange(card.index, event.target.value)}
                  />
                )}

                {!card.error && (
                  <div className="card-instruction-row">
                    <input
                      type="text"
                      placeholder="예: 이 카드 색상을 파란색으로 바꿔줘"
                      value={instructionText[card.index] ?? ''}
                      onChange={(event) =>
                        setInstructionText((previous) => ({
                          ...previous,
                          [card.index]: event.target.value
                        }))
                      }
                      disabled={applyingInstruction[card.index] || card.regenerating}
                    />
                    <button
                      type="button"
                      onClick={() => handleApplyInstruction(card)}
                      disabled={
                        applyingInstruction[card.index] ||
                        card.regenerating ||
                        !instructionText[card.index]?.trim()
                      }
                    >
                      {applyingInstruction[card.index] ? '적용 중...' : '적용'}
                    </button>
                    {previousHtml[card.index] !== undefined && (
                      <button
                        type="button"
                        onClick={() => handleRevertInstruction(card)}
                        disabled={applyingInstruction[card.index] || card.regenerating}
                      >
                        되돌리기
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleRegenerateCard(card)}
                  disabled={card.regenerating || applyingInstruction[card.index]}
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
