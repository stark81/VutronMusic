import axios from 'axios'
import crypto from 'crypto'
import store from './store'

const url = `http://localhost:4533`
const apiVersion = '1.16.1'
const client = 'VutronMusic'
const username = (store.get('accounts.navidrome.username') as string) || ''
const password = (store.get('accounts.navidrome.password') as string) || ''

const generateToken = (password: string, salt: string) => {
  return crypto
    .createHash('md5')
    .update(password + salt)
    .digest('hex')
}

const navidromeRequest = (
  parmas: { endpoint: any; query: any },
  username: string,
  password: string
) => {
  const salt = crypto.randomBytes(4).toString('hex')
  const token = generateToken(password, salt)

  return axios.get(`${url}/rest/${parmas.endpoint}`, {
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
}

export const testNavidrome = async () => {
  try {
    const response = await navidromeRequest(
      {
        endpoint: 'getMusicFolders.view',
        query: {}
      },
      username,
      password
    )
    const folderId = response.data['subsonic-response'].musicFolders.musicFolder[0].id
    const response2 = await navidromeRequest(
      {
        endpoint: 'search3.view',
        query: { query: '', songCount: 5000, musicFolderId: folderId }
      },
      username,
      password
    )
    console.log(
      '====== from navidrome ======',
      response2.data['subsonic-response'].searchResult3.song[0]
    )
  } catch (error) {
    console.log(error)
  }
}
