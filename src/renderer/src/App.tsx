import { useState } from 'react'

interface FormMessage {
  type: 'error' | 'success'
  text: string
}

function App(): React.JSX.Element {
  const [keyword, setKeyword] = useState('')
  const [title, setTitle] = useState('')
  const [homepageUrl, setHomepageUrl] = useState('')
  const [thumbnailPath, setThumbnailPath] = useState('')
  const [message, setMessage] = useState<FormMessage | null>(null)
  const [submitting, setSubmitting] = useState(false)

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
      } else {
        setMessage({ type: 'error', text: result.error.message })
      }
    } catch {
      setMessage({ type: 'error', text: '등록 중 알 수 없는 오류가 발생했습니다' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="registration-form" onSubmit={handleSubmit}>
      <h1>썸네일 등록</h1>

      <label>
        키워드
        <input type="text" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
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
  )
}

export default App
