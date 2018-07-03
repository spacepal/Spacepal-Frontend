import Vue from 'vue'
import Router from 'vue-router'
import Games from '@/pages/Games.vue'
import CreateGame from '@/pages/CreateGame.vue'
import Game from '@/pages/Game.vue'
import Room from '@/pages/Room.vue'
import Test from '@/components/Test.vue'
import store from '@/store'

Vue.use(Router)

function beforeEnter (to, _, next) {
  let isRoom = store.getters['game/isRoom']
  let isGame = store.getters['game/isGame']
  if (isRoom && to.name !== 'Room') {
    return next({ name: 'Room' })
  }
  if (isGame && to.name !== 'Game') {
    return next({ name: 'Game' })
  }
  if (to.name === 'Game' || to.name === 'Room') {
    return next({ name: 'Games' })
  }
  next()
}

export default new Router({
  routes: [
    {
      path: '*',
      name: 'NotFound',
      redirect: {
        name: 'Games'
      }
    },
    {
      path: '/',
      name: 'Games',
      component: Games,
      beforeEnter
    },
    {
      path: '/create',
      name: 'CreateGame',
      component: CreateGame,
      beforeEnter
    },
    {
      path: '/play',
      name: 'Game',
      component: Game,
      beforeEnter
    },
    {
      path: '/room',
      name: 'Room',
      component: Room,
      beforeEnter
    },
    {
      path: '/test',
      name: 'Test',
      component: Test
    }
  ]
})
