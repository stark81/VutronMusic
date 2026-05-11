import request from '../utils/request'

export function getComment(params: {
  id: number | string
  type: number
  pageNo?: number
  pageSize?: number
  sortType?: number
  cursor?: number
}) {
  return request({
    url: '/comment/new',
    method: 'get',
    params
  })
}

export function likeComment(params: { id: number | string; cid: number; t: number; type: number }) {
  return request({
    url: '/comment/like',
    method: 'get',
    params
  })
}

export function getFloorComment(params: {
  parentCommentId: number | string
  id: number | string
  type: number
  limit?: number
  time?: number
}) {
  return request({
    url: '/comment/floor',
    method: 'get',
    params
  })
}

export function submitComment(params: {
  t: number
  type: number
  id: number | string
  content?: string
  commentId?: number
}) {
  return request({
    url: '/comment',
    method: 'post',
    params
  })
}
