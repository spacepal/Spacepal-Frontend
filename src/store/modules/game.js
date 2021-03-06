import Vue from 'vue'
import Service from '../../common/Service.js'
import debug from '../../common/Debug.js'

const STATE_UNKNOWN = 0
const STATE_ROOM = 1
const STATE_GAME = 2
const STATE_END = 3

const DEFAULT_INFO = {
  accumulative: null,
  buffs: null,
  creator: '',
  id: null,
  mapHeight: null,
  mapWidth: null,
  name: null,
  pinCode: null,
  pirates: null,
  planets: null,
  playersLimit: null,
  productionAfterCapture: null,
  turnNumber: 0,
  state: STATE_UNKNOWN
}

const state = {
  info: Object.assign({}, DEFAULT_INFO)
}

const mutations = {
  SET_GAME_INFO (state, gameInfo) {
    Object.keys(gameInfo).forEach(key => {
      Vue.set(state.info, key, gameInfo[key])
    })
  }
}

const actions = {
  reset ({ commit }) {
    commit('SET_GAME_INFO', DEFAULT_INFO)
  },
  setInfo ({ commit, dispatch }, gameInfo) {
    commit('SET_GAME_INFO', gameInfo)
    dispatch('syncSet', 'game', { root: true })
  },
  joinRandom ({ dispatch }, { username }) {
    return Service.game.joinRandom(username).then((resp) => {
      if (resp.data.errors) {
        throw new Error(resp.data.errors[0])
      }
      let gameID = resp.data.gameID
      dispatch('login', gameID, { root: true })
      return gameID
    })
  },
  join ({ dispatch }, { gameID, pinCode, username }) {
    return Service.game.join(gameID, pinCode, username).then((resp) => {
      if (resp.data.errors) {
        throw new Error(resp.data.errors[0])
      }
      dispatch('login', gameID, { root: true })
      return gameID
    })
  },
  create ({ dispatch }, data) {
    return Service.game.create(data).then((resp) => {
      if (resp.data.errors) {
        throw new Error(resp.data.errors[0])
      }
      dispatch('login', resp.data.gameID, { root: true })
      return resp.data.gameID
    })
  },
  start ({ rootGetters, rootState }) {
    if (rootGetters.sync.game &&
      rootGetters.sync.profile &&
      rootGetters.sync.members &&
      rootGetters.isCreator &&
      Object.keys(rootGetters.members).length >= 2 &&
      rootGetters['game/isRoom']) {
      rootState.cable.get(rootState.gameID).start()
      return true
    }
    return false
  },
  addBot ({ rootState, dispatch }) {
    dispatch('syncUnset', 'members', { root: true })
    rootState.cable.get(rootState.gameID).addBot()
  },
  delBot ({ rootState, dispatch }, id) {
    dispatch('syncUnset', 'members', { root: true })
    rootState.cable.get(rootState.gameID).delBot(id)
  },
  endTurn ({ dispatch, rootState, rootGetters }) {
    if (rootGetters.isLocked) {
      debug.warn('game.endTurn is locked')
      return
    }
    let fleets = rootGetters['tasks/all']
    dispatch('lock', null, { root: true })
    rootState.cable.get(rootState.gameID).endTurn(Object.values(fleets))
  },
  logout (_, gameID) {
    if (gameID === null) {
      return new Promise((resolve) => resolve())
    }
    return Service.game.logout(gameID)
  }
}

const getters = {
  hasFreePlace: (state, _, __, rootGetters) => {
    if (!rootGetters.sync.game || !rootGetters.sync.members) {
      return false
    }
    let limit = state.info.playersLimit || 0
    return limit > Object.values(rootGetters.members).length
  },
  isRoom: (state, _, __, rootGetters) => {
    return rootGetters.isPlayer && state.info.state === STATE_ROOM
  },
  isGame: (state, _, __, rootGetters) => {
    return rootGetters.isPlayer && state.info.state === STATE_GAME
  },
  isOver: (state, _, __, rootGetters) => {
    return rootGetters.isPlayer && state.info.state === STATE_END
  },
  isUnknown: (state, _, __, rootGetters) => {
    return rootGetters.isPlayer && state.info.state === STATE_UNKNOWN
  },
  info: (state) => state.info
}

export default {
  namespaced: true,
  state,
  mutations,
  getters,
  actions
}
