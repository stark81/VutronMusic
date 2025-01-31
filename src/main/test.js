const axios = require('axios')

const url = 'http://192.168.3.28:4533/auth/login'
const data = {
  username: 'stark81',
  password: '932024'
}
const headers = {
  'content-type': 'application/json'
}

axios.post(url, data, { headers }).then((response) => {
  console.log('======11======', response)
})
