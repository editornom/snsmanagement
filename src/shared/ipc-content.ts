export const CONTENT_SELECT_THUMBNAIL_CHANNEL = 'content:select-thumbnail'
export const CONTENT_REGISTER_CHANNEL = 'content:register'

export interface RegisterContentRequest {
  keyword: string
  title: string
  homepageUrl: string
  thumbnailPath: string
}

export interface RegisterContentResponseData {
  folderPath: string
}

export interface IpcOk<T> {
  ok: true
  data: T
}

export interface IpcFailure {
  ok: false
  error: { message: string }
}

export type IpcResult<T> = IpcOk<T> | IpcFailure
