import axios from 'axios'

const url = `http://localhost:8096`
const apiKey = 'f4f75f4a0f7e471692b3766e2fd57248'

export const testEmby = async () => {
  const { data } = await axios
    .get(`${url}/emby/Library/MediaFolders`, {
      headers: { 'X-Emby-Token': apiKey }
    })
    .catch((err) => {
      console.log('====== from emby error ======', err)
      return err
    })
  if (!data) return
  const item = data.Items[0]
  const { Id } = item
  const { data: data2 } = await axios.get(`${url}/emby/Items`, {
    headers: { 'X-Emby-Token': apiKey },
    params: { ParentId: Id, IncludeItemTypes: 'Audio', Recursive: true }
  })
  console.log('====== from emby ======', data2)
}
