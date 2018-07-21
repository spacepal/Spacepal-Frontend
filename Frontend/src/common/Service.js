
import { API_URL } from './constants.js'
import axios from 'axios'

const service = {
  game: {
    status () {
      return axios.get(API_URL + 'games/status')
    },
    all (offset, limit) {
      return axios.get(API_URL + 'games', {
        params: {
          offset,
          limit
        }
      })
    },
    create (data) {
      return axios.post(API_URL + 'games', { data }, { withCredentials: true })
    },
    joinRandom (username) {
      return axios.put(`${API_URL}games/random/join`,
        { data: { username } },
        { withCredentials: true })
    },
    join (gameID, pinCode, username) {
      return axios.put(`${API_URL}games/${gameID}/join`, {
        data: {
          pinCode,
          username
        }
      }, { withCredentials: true })
    },
    logout (gameID) {
      return axios.delete(`${API_URL}games/${gameID}/player`, { withCredentials: true })
    }
  }
}

export default service
