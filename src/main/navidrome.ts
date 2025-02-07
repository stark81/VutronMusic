import axios from 'axios'
import crypto from 'crypto'
import store from './store'

const apiVersion = '1.16.1'
const client = 'VutronMusic'

const generateToken = (password: string, salt: string) => {
  return crypto
    .createHash('md5')
    .update(password + salt)
    .digest('hex')
}

export const navidromeRequest = (parmas: { endpoint: any; query: any }) => {
  const url = (store.get('accounts.navidrome.url') as string) || ''
  const username = (store.get('accounts.navidrome.username') as string) || ''
  const password = (store.get('accounts.navidrome.password') as string) || ''

  if (url === '' || username === '' || password === '') return

  const salt = crypto.randomBytes(4).toString('hex')
  const token = generateToken(password, salt)

  return axios
    .get(`${url}/rest/${parmas.endpoint}`, {
      params: {
        ...parmas.query,
        u: username,
        t: token,
        s: salt,
        v: apiVersion,
        c: client,
        f: 'json'
      }
    })
    .then((res: any) => res.data['subsonic-response'])
    .catch()
}
