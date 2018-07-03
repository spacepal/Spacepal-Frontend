import Vue from 'vue'

const state = {
  members: {}
}

const mutations = {
  SET_MEMBERS (state, members) {
    members.forEach(m => {
      Vue.set(state.members, m.id, m)
    })
  },
  CLEAR_PLANERS (state) {
    state.members = {}
  }
}

const actions = {
  setMembers ({ commit }, members) {
    commit('CLEAR_PLANERS')
    commit('SET_MEMBERS', members)
  }
}

const getters = {
  member (state) {
    return (memberID) => {
      return state.members[memberID]
    }
  },
  members (state) {
    return state.members
  }
}

export default {
  state,
  mutations,
  getters,
  actions
}
